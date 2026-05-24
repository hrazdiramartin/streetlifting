# Jednoduchý HTTP server pro statický web (Windows PowerShell 5.1+)
# Použití: powershell -File serve.ps1 [-Port 8765]

param(
    [int]$Port = 8765,
    [string]$Root = $PSScriptRoot
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
    $listener.Start()
    Write-Host "Streetlifting server bezi na http://localhost:$Port/" -ForegroundColor Green
    Write-Host "Stiskni Ctrl+C pro zastaveni." -ForegroundColor DarkGray
    Write-Host "Root: $Root" -ForegroundColor DarkGray

    $mimeTypes = @{
        '.html' = 'text/html; charset=utf-8'
        '.htm'  = 'text/html; charset=utf-8'
        '.css'  = 'text/css; charset=utf-8'
        '.js'   = 'application/javascript; charset=utf-8'
        '.json' = 'application/json; charset=utf-8'
        '.svg'  = 'image/svg+xml'
        '.png'  = 'image/png'
        '.jpg'  = 'image/jpeg'
        '.jpeg' = 'image/jpeg'
        '.gif'  = 'image/gif'
        '.ico'  = 'image/x-icon'
        '.woff' = 'font/woff'
        '.woff2'= 'font/woff2'
        '.txt'  = 'text/plain; charset=utf-8'
    }

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        $path = $req.Url.AbsolutePath
        if ($path -eq '/') { $path = '/index.html' }
        $filePath = Join-Path $Root $path.TrimStart('/')

        try {
            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentType = $mime
                $res.ContentLength64 = $bytes.Length
                $res.StatusCode = 200
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "200 $($req.HttpMethod) $path" -ForegroundColor DarkGreen
            } else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
                $res.OutputStream.Write($msg, 0, $msg.Length)
                Write-Host "404 $($req.HttpMethod) $path" -ForegroundColor Yellow
            }
        }
        catch {
            $res.StatusCode = 500
            Write-Host "500 $($req.HttpMethod) $path -- $_" -ForegroundColor Red
        }
        finally {
            $res.OutputStream.Close()
        }
    }
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
}
