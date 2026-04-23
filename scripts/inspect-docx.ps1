param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$resolved = Resolve-Path -LiteralPath $Path
$fileStream = [System.IO.File]::Open(
  $resolved.Path,
  [System.IO.FileMode]::Open,
  [System.IO.FileAccess]::Read,
  [System.IO.FileShare]::ReadWrite
)
$zip = New-Object System.IO.Compression.ZipArchive($fileStream, [System.IO.Compression.ZipArchiveMode]::Read)
try {
  $entry = $zip.GetEntry("word/document.xml")
  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream)
    [xml]$xml = $reader.ReadToEnd()
  } finally {
    $stream.Dispose()
  }
} finally {
  $zip.Dispose()
  $fileStream.Dispose()
}

$ns = New-Object System.Xml.XmlNamespaceManager -ArgumentList $xml.NameTable
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

$index = 0
$xml.SelectNodes("//w:body/w:p", $ns) | ForEach-Object {
  $index += 1
  $styleNode = $_.SelectSingleNode("./w:pPr/w:pStyle", $ns)
  $style = if ($styleNode) { $styleNode.GetAttribute("val", $ns.LookupNamespace("w")) } else { "" }
  $text = ($_.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join ""
  if ($text.Trim().Length -gt 0 -or $style.Length -gt 0) {
    "{0}`t{1}`t{2}" -f $index, $style, $text
  }
}
