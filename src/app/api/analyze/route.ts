import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { requireAuthResponse, withTimeout, ResilienceError } from '@/lib/resilience'

// Hard ceiling for the upstream LLM call so a hung provider cannot pin a
// request open indefinitely.
const LLM_TIMEOUT_MS = 30_000

export async function POST(request: NextRequest) {
  // Fail-closed auth gate: this route triggers paid LLM work and DB writes,
  // so it must not be reachable anonymously. The expected token is a static
  // server-side API key; when it is unset the helper returns 503 (never allow).
  const authError = requireAuthResponse(request, {
    token: process.env.ANALYZE_API_KEY,
  })
  if (authError) return authError

  try {
    const body = await request.json()
    const { anomalyId } = body

    if (!anomalyId) {
      return NextResponse.json({ error: 'anomalyId is required' }, { status: 400 })
    }

    const anomaly = await db.anomaly.findUnique({
      where: { id: anomalyId },
    })

    if (!anomaly) {
      return NextResponse.json({ error: 'Anomaly not found' }, { status: 404 })
    }

    // Check if already analyzed
    const existingAnalysis = await db.aIAnalysis.findFirst({
      where: { anomalyId },
    })

    if (existingAnalysis) {
      return NextResponse.json({
        analysis: existingAnalysis,
        message: 'Anomaly already analyzed',
      })
    }

    // Use z-ai-web-dev-sdk for AI analysis, bounded by a hard timeout so a
    // stalled provider releases the request instead of hanging open.
    const zai = await withTimeout(ZAI.create(), LLM_TIMEOUT_MS, 'ZAI.create')
    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are ChainSight AI, an expert on-chain analyst specializing in detecting and analyzing blockchain anomalies on the Mantle Network. Provide detailed risk assessments and actionable recommendations. Be specific about amounts, addresses, and patterns. Respond in plain text with clear sections: SUMMARY, RISK LEVEL (low/medium/high/critical), and RECOMMENDATION.',
          },
          {
            role: 'user',
            content: `Analyze this on-chain anomaly:\n\nType: ${anomaly.type}\nSeverity: ${anomaly.severity}\nConfidence: ${(anomaly.confidence * 100).toFixed(0)}%\nDescription: ${anomaly.description}\nMetadata: ${anomaly.metadata}\n\nProvide: 1) A brief summary 2) Risk level assessment 3) Actionable recommendation`,
          },
        ],
        temperature: 0.3,
      }),
      LLM_TIMEOUT_MS,
      'ZAI.chat.completions.create',
    )

    const rawResponse = completion.choices?.[0]?.message?.content || 'Analysis unavailable'

    // Parse the response to extract risk level
    let riskLevel = anomaly.severity
    const riskMatch = rawResponse.match(/RISK LEVEL[:\s]*(low|medium|high|critical)/i)
    if (riskMatch) {
      riskLevel = riskMatch[1].toLowerCase()
    }

    // Extract summary and recommendation
    let summary = rawResponse
    let recommendation = ''

    const summaryMatch = rawResponse.match(/SUMMARY[:\s]*([\s\S]*?)(?=RISK LEVEL|$)/i)
    if (summaryMatch) {
      summary = summaryMatch[1].trim()
    }

    const recMatch = rawResponse.match(/RECOMMENDATION[:\s]*([\s\S]*?)$/i)
    if (recMatch) {
      recommendation = recMatch[1].trim()
    }

    // Create AI analysis record
    const analysis = await db.aIAnalysis.create({
      data: {
        anomalyId: anomaly.id,
        summary,
        riskLevel,
        recommendation,
        rawResponse,
      },
    })

    // Mark anomaly as analyzed
    await db.anomaly.update({
      where: { id: anomaly.id },
      data: { isAnalyzed: true, analyzedAt: new Date() },
    })

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Analyze API error:', error)
    if (error instanceof ResilienceError && error.kind === 'timeout') {
      return NextResponse.json(
        { error: 'AI analysis timed out, please retry' },
        { status: 504 },
      )
    }
    return NextResponse.json({ error: 'Failed to analyze anomaly' }, { status: 500 })
  }
}
