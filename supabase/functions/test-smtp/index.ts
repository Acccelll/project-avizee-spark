import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { host, porta, usuario, senha, ssl } = await req.json()

    if (!host || !porta) {
      return json({ sucesso: false, mensagem: 'Host e porta são obrigatórios.' })
    }

    const port = Number(porta)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return json({ sucesso: false, mensagem: 'Porta SMTP inválida.' })
    }

    if (!usuario || !usuario.trim()) {
      return json({ sucesso: false, mensagem: 'Usuário SMTP não informado.' })
    }

    try {
      const conn = ssl
        ? await Deno.connectTls({ hostname: host, port })
        : await Deno.connect({ hostname: host, port })

      const buf = new Uint8Array(512)
      const n = await conn.read(buf)
      const banner = n ? new TextDecoder().decode(buf.subarray(0, n)) : ''
      conn.close()

      if (banner.startsWith('220')) {
        return json({ sucesso: true, mensagem: `Conectado a ${host}:${port} — ${banner.trim().slice(0, 80)}` })
      }

      return json({ sucesso: false, mensagem: `Resposta inesperada: ${banner.trim().slice(0, 80)}` })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return json({ sucesso: false, mensagem: `Falha na conexão: ${msg}` })
    }
  } catch {
    return json({ sucesso: false, mensagem: 'Erro ao processar requisição.' }, 400)
  }
})
