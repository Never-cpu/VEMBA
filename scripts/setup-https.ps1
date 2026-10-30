$ErrorActionPreference = 'Stop'

# Trust only a localhost server certificate for the current Windows user.
# No certificate authority, machine-wide trust, or browser security override.
$projectRoot = Split-Path -Parent $PSScriptRoot
$certificateDirectory = Join-Path $projectRoot '.local\https'
$certificatePath = Join-Path $certificateDirectory 'localhost.pfx'
[System.IO.Directory]::CreateDirectory($certificateDirectory) | Out-Null

$certificate = $null
if (Test-Path -LiteralPath $certificatePath) {
    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
        $certificatePath, '',
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
    )
    if ($certificate.NotAfter -lt (Get-Date).AddDays(7)) {
        $certificate.Dispose()
        $certificate = $null
    }
}

if ($null -eq $certificate) {
    $certificateOptions = @{
        Subject = 'CN=localhost'
        FriendlyName = 'Vemba localhost development HTTPS'
        Type = 'SSLServerAuthentication'
        TextExtension = @('2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1&IPAddress=::1')
        CertStoreLocation = 'Cert:\CurrentUser\My'
        KeyAlgorithm = 'RSA'
        KeyLength = 2048
        HashAlgorithm = 'SHA256'
        KeyExportPolicy = 'Exportable'
        NotBefore = (Get-Date).AddMinutes(-10)
        NotAfter = (Get-Date).AddDays(180)
    }
    $certificate = New-SelfSignedCertificate @certificateOptions
    [System.IO.File]::WriteAllBytes(
        $certificatePath,
        $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx)
    )
}

$publicCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certificate.RawData)
$trustStore = [System.Security.Cryptography.X509Certificates.X509Store]::new('Root', 'CurrentUser')
try {
    $trustStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    if (-not ($trustStore.Certificates | Where-Object { $_.Thumbprint -eq $certificate.Thumbprint })) {
        $trustStore.Add($publicCertificate)
    }
    Write-Host ('Local HTTPS ready for https://localhost:5173 (expires {0:yyyy-MM-dd}).' -f $certificate.NotAfter)
} finally {
    $trustStore.Close()
    $publicCertificate.Dispose()
    $certificate.Dispose()
}
