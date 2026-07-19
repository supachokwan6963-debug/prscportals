import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ใช้ base64Image ให้ตรงกับที่ client (submitSOS-fixed.js) ส่งมา
    const { base64Image, mimeType } = await req.json()

    if (!base64Image) {
      return new Response(JSON.stringify({ isSafe: false, reason: 'no_image' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not set')
      // fail-closed: ตั้งค่าไม่ครบ ให้ถือว่าไม่ปลอดภัยไว้ก่อน
      return new Response(JSON.stringify({ isSafe: false, reason: 'server_misconfig' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "ตรวจสอบรูปภาพนี้ว่าเหมาะสมกับโรงเรียนหรือไม่ ตอบคำเดียวเท่านั้น: SAFE ถ้าปลอดภัย หรือ UNSAFE ถ้าไม่ปลอดภัย" },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: base64Image } }
            ]
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 10 }
        })
      }
    )

    // ต้องเช็ค response.ok ก่อน ไม่งั้น error response จาก Gemini
    // จะเงียบๆ ไหลต่อไปเป็น "UNSAFE" แล้วโดนบั๊ก includes() ทำให้กลายเป็น safe
    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', errText)
      return new Response(JSON.stringify({ isSafe: false, reason: 'moderation_unavailable' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const data = await response.json()
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!resultText) {
      return new Response(JSON.stringify({ isSafe: false, reason: 'no_response' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // แก้บั๊กเดิม: ต้องเช็ค "ขึ้นต้นด้วย" SAFE ไม่ใช่แค่ "มีคำว่า" SAFE
    // เพราะ "UNSAFE".includes('SAFE') === true ด้วย
    const isSafe = resultText.trim().toUpperCase().startsWith('SAFE')

    return new Response(JSON.stringify({ isSafe }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Edge Function error:', err)
    // fail-closed แม้ error ไม่คาดคิดก็ตาม
    return new Response(JSON.stringify({ isSafe: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
