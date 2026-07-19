import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64, mimeType } = await req.json()
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "ตรวจสอบรูปภาพนี้ว่าเหมาะสมกับโรงเรียนหรือไม่ ตอบแค่ SAFE ถ้าปลอดภัย หรือ UNSAFE ถ้าไม่" },
            { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } }
          ]
        }]
      })
    })

    const data = await response.json()
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "UNSAFE"
    
    return new Response(JSON.stringify({ isSafe: resultText.includes('SAFE') }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
