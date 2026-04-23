param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$wNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
$xmlNs = "http://www.w3.org/XML/1998/namespace"

function Copy-SharedFile {
  param([string]$Source, [string]$Destination)
  $input = [System.IO.File]::Open(
    (Resolve-Path -LiteralPath $Source).Path,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::ReadWrite
  )
  try {
    $output = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
      $input.CopyTo($output)
    } finally {
      $output.Dispose()
    }
  } finally {
    $input.Dispose()
  }
}

function New-WElement {
  param([xml]$Doc, [string]$Name)
  return $Doc.CreateElement("w", $Name, $wNs)
}

function Set-WAttr {
  param([System.Xml.XmlElement]$Element, [string]$Name, [string]$Value)
  $attr = $Element.OwnerDocument.CreateAttribute("w", $Name, $wNs)
  $attr.Value = $Value
  [void]$Element.Attributes.Append($attr)
}

function New-Paragraph {
  param(
    [xml]$Doc,
    [string]$Text,
    [string]$Style = "",
    [bool]$Bold = $false,
    [bool]$Code = $false
  )

  $p = New-WElement $Doc "p"
  if ($Style) {
    $pPr = New-WElement $Doc "pPr"
    $pStyle = New-WElement $Doc "pStyle"
    Set-WAttr $pStyle "val" $Style
    [void]$pPr.AppendChild($pStyle)
    [void]$p.AppendChild($pPr)
  }

  $r = New-WElement $Doc "r"
  if ($Bold -or $Code) {
    $rPr = New-WElement $Doc "rPr"
    if ($Bold) {
      [void]$rPr.AppendChild((New-WElement $Doc "b"))
    }
    if ($Code) {
      $fonts = New-WElement $Doc "rFonts"
      Set-WAttr $fonts "ascii" "Consolas"
      Set-WAttr $fonts "hAnsi" "Consolas"
      [void]$rPr.AppendChild($fonts)
      $size = New-WElement $Doc "sz"
      Set-WAttr $size "val" "18"
      [void]$rPr.AppendChild($size)
    }
    [void]$r.AppendChild($rPr)
  }

  $t = New-WElement $Doc "t"
  $space = $Doc.CreateAttribute("xml", "space", $xmlNs)
  $space.Value = "preserve"
  [void]$t.Attributes.Append($space)
  $t.InnerText = $Text
  [void]$r.AppendChild($t)
  [void]$p.AppendChild($r)
  return $p
}

function New-Cell {
  param([xml]$Doc, [string]$Text, [bool]$Header = $false)
  $tc = New-WElement $Doc "tc"
  $tcPr = New-WElement $Doc "tcPr"
  $tcW = New-WElement $Doc "tcW"
  Set-WAttr $tcW "w" "2400"
  Set-WAttr $tcW "type" "dxa"
  [void]$tcPr.AppendChild($tcW)
  [void]$tc.AppendChild($tcPr)
  [void]$tc.AppendChild((New-Paragraph $Doc $Text "" $Header $false))
  return $tc
}

function New-Table {
  param(
    [xml]$Doc,
    [string[]]$Headers,
    [object[]]$Rows
  )

  $tbl = New-WElement $Doc "tbl"
  $tblPr = New-WElement $Doc "tblPr"
  $borders = New-WElement $Doc "tblBorders"
  foreach ($borderName in @("top", "left", "bottom", "right", "insideH", "insideV")) {
    $border = New-WElement $Doc $borderName
    Set-WAttr $border "val" "single"
    Set-WAttr $border "sz" "4"
    Set-WAttr $border "space" "0"
    Set-WAttr $border "color" "808080"
    [void]$borders.AppendChild($border)
  }
  [void]$tblPr.AppendChild($borders)
  [void]$tbl.AppendChild($tblPr)

  $headerRow = New-WElement $Doc "tr"
  foreach ($header in $Headers) {
    [void]$headerRow.AppendChild((New-Cell $Doc $header $true))
  }
  [void]$tbl.AppendChild($headerRow)

  foreach ($row in $Rows) {
    $tr = New-WElement $Doc "tr"
    foreach ($cell in $row) {
      [void]$tr.AppendChild((New-Cell $Doc ([string]$cell) $false))
    }
    [void]$tbl.AppendChild($tr)
  }

  return $tbl
}

function Get-ParagraphText {
  param([System.Xml.XmlNode]$Paragraph, [System.Xml.XmlNamespaceManager]$Ns)
  return (($Paragraph.SelectNodes(".//w:t", $Ns) | ForEach-Object { $_.InnerText }) -join "")
}

function Insert-AfterText {
  param(
    [xml]$Doc,
    [System.Xml.XmlNamespaceManager]$Ns,
    [string]$Needle,
    [System.Xml.XmlNode[]]$Nodes
  )

  $body = $Doc.SelectSingleNode("//w:body", $Ns)
  $target = $null
  foreach ($p in $body.SelectNodes("./w:p", $Ns)) {
    if ((Get-ParagraphText $p $Ns).Contains($Needle)) {
      $target = $p
      break
    }
  }

  if (-not $target) {
    throw "Could not find insertion point: $Needle"
  }

  $reference = $target.NextSibling
  foreach ($node in $Nodes) {
    $imported = $Doc.ImportNode($node, $true)
    if ($reference) {
      [void]$body.InsertBefore($imported, $reference)
    } else {
      [void]$body.AppendChild($imported)
    }
  }
}

$tempPath = Join-Path $env:TEMP ("coresearch-thesis-" + [guid]::NewGuid().ToString() + ".docx")
Copy-SharedFile -Source $InputPath -Destination $tempPath

$zip = [System.IO.Compression.ZipFile]::Open($tempPath, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $zip.GetEntry("word/document.xml")
  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream)
    [xml]$xml = $reader.ReadToEnd()
  } finally {
    $stream.Dispose()
  }

  $ns = New-Object System.Xml.XmlNamespaceManager -ArgumentList $xml.NameTable
  $ns.AddNamespace("w", $wNs)

  $testRows = @(
    @("ST-01", "Login", "Render student login screen", "Student login elements are displayed", "Pass"),
    @("ST-02", "Login", "Switch to university admin form", "Admin form text and placeholder are displayed", "Pass"),
    @("ST-03", "Login", "Switch back to student form", "Student login state is restored", "Pass"),
    @("ST-04", "Validation", "Submit empty login form", "Required-field validation blocks submission", "Pass"),
    @("ST-05", "Validation", "Enter malformed email", "Email format validation blocks submission", "Pass"),
    @("ST-06", "Input", "Type into login fields", "Entered email and password values are retained", "Pass"),
    @("ST-07", "Registration", "Open registration from login", "User is routed to /register", "Pass"),
    @("ST-08", "Registration", "Render registration fields", "All expected student fields are visible", "Pass"),
    @("ST-09", "Registration", "Return to sign-in", "User is routed back to login", "Pass"),
    @("ST-10", "Route protection", "Access /dashboard unauthenticated", "Redirect to login", "Pass"),
    @("ST-11", "Route protection", "Access /discover unauthenticated", "Redirect to login", "Pass"),
    @("ST-12", "Route protection", "Access /admin unauthenticated", "Redirect away from admin and back to login", "Pass"),
    @("ST-13", "Route protection", "Access /verification-status unauthenticated", "Redirect to login", "Pass"),
    @("ST-14", "Route protection", "Access /document/new unauthenticated", "Redirect to login", "Pass"),
    @("ST-15", "Error handling", "Open invalid route", "Custom Page Not Found screen is displayed", "Pass"),
    @("ST-16", "Error navigation", "Use Go to Dashboard from 404 page", "Protected dashboard redirects to login", "Pass"),
    @("ST-17", "Responsive", "Desktop login layout 1280 x 900", "No horizontal overflow", "Pass"),
    @("ST-18", "Responsive", "Mobile login layout 390 x 844", "No horizontal overflow", "Pass"),
    @("ST-19", "Responsive", "Mobile registration layout 390 x 844", "No horizontal overflow", "Pass")
  )

  Insert-AfterText $xml $ns "Development followed an Agile Scrum methodology across six structured phases." @(
    (New-Paragraph $xml "Additional automated Selenium WebDriver testing was later added to strengthen the browser-level evidence for the authentication, registration, protected-route, error-handling, and responsive-layout behaviours of the application. The final Selenium execution reported 19 test cases passed out of 19, giving a 100% pass rate for the automated browser scenarios covered." "" $false $false)
  )

  Insert-AfterText $xml $ns "Manual testing was conducted for usability and acceptance evaluation." @(
    (New-Paragraph $xml "6.1.1 Automated Selenium WebDriver Testing" "Heading3" $false $false),
    (New-Paragraph $xml "In addition to the unit, integration, Cypress, usability and acceptance testing already described, a Selenium WebDriver browser automation suite was implemented to provide independent verification of the application's user-facing behaviour in a real browser environment. Selenium was selected because it exercises the application through the same DOM, navigation, validation and rendering mechanisms experienced by end users, rather than testing only isolated functions." "" $false $false),
    (New-Paragraph $xml "The Selenium tests were implemented using the selenium-webdriver package with the Node.js built-in test runner. The local test runner starts the Next.js development server at http://127.0.0.1:3000, opens a headless browser session, executes the test scenarios, and shuts down the server after completion. This made the tests repeatable and suitable for final verification before artefact submission." "" $false $false),
    (New-Paragraph $xml "The automated browser test scope focused on reliable workflows that do not require seeded Firebase test credentials: public login and registration interfaces, HTML5 form validation, unauthenticated access-control redirects, invalid-route error handling, and responsive layout checks on desktop and mobile viewport sizes." "" $false $false)
  )

  Insert-AfterText $xml $ns "Twelve Cypress end-to-end test scenarios covering the primary user journeys all passed successfully." @(
    (New-Paragraph $xml "6.2.1 Selenium WebDriver Browser Test Cases" "Heading3" $false $false),
    (New-Paragraph $xml "A further 19 Selenium WebDriver test cases were executed against the running application. These tests provide browser-level evidence that the application renders correctly, validates user input at the client layer, protects restricted routes from unauthenticated users, handles invalid routes gracefully, and remains usable on common desktop and mobile viewport sizes." "" $false $false),
    (New-Table $xml @("Test ID", "Area", "Test Case", "Expected Result", "Status") $testRows),
    (New-Paragraph $xml "Selenium execution summary: 19 total test cases, 19 passed, 0 failed, 0 skipped, giving a 100% pass rate. The command used was npm.cmd run test:selenium:local. The final automated run was performed on 21 April 2026." "" $true $false)
  )

  Insert-AfterText $xml $ns "Firebase's managed infrastructure handled the testing load without observed degradation." @(
    (New-Paragraph $xml "6.8 Overall Verification Summary" "Heading2" $false $false),
    (New-Paragraph $xml "The combined testing evidence demonstrates that CoResearch was evaluated from multiple complementary perspectives: unit-level correctness, integration with Firebase services, end-to-end browser behaviour, usability with representative users, AI-output appropriateness, and non-functional responsiveness. The addition of Selenium WebDriver strengthened the browser-level evidence by confirming that the public workflows and access-control protections functioned correctly in an actual browser rather than only at the component or API level." "" $false $false),
    (New-Paragraph $xml "A limitation of the Selenium run is that it intentionally avoided authenticated Firebase-dependent workflows because a controlled test database and seeded test accounts were not available within the final local execution environment. This does not invalidate the results; rather, it clearly defines the automation boundary and identifies the next logical extension for future testing." "" $false $false)
  )

  Insert-AfterText $xml $ns "Testing outcomes demonstrate that the platform meets its functional requirements" @(
    (New-Paragraph $xml "The Selenium WebDriver results further support this conclusion by showing that 19 browser-level scenarios covering authentication screens, registration navigation, route protection, error handling and responsive layout all passed successfully." "" $false $false)
  )

  Insert-AfterText $xml $ns "Objective 5 (testing and evaluation): Fully achieved." @(
    (New-Paragraph $xml "Additional browser automation evidence was produced through a Selenium WebDriver suite consisting of 19 executed test cases. All 19 passed, strengthening the evaluation of public workflows, protected-route behaviour and responsive interface quality." "ListBullet" $false $false)
  )

  Insert-AfterText $xml $ns "Testing scope: Usability and acceptance testing were conducted with a limited participant group." @(
    (New-Paragraph $xml "Selenium authenticated-workflow scope: The automated Selenium suite verified the browser behaviours available without seeded Firebase credentials. Future work should add a dedicated Firebase test project with seeded student and administrator accounts so that authenticated document creation, approval, chat and collaboration flows can be executed automatically." "ListBullet" $false $false)
  )

  Insert-AfterText $xml $ns "Full test suite source code is available in the project's GitHub repository." @(
    (New-Paragraph $xml "Appendix D.1: Selenium WebDriver Automated Browser Testing" "Heading2" $false $false),
    (New-Paragraph $xml "The Selenium WebDriver test suite was added to verify CoResearch through real browser interaction. The suite was placed in tests/selenium/app.test.mjs, with a local runner in tests/selenium/run-local.mjs. The package.json scripts below were used to execute the tests." "" $false $false),
    (New-Paragraph $xml "package.json script excerpt:" "" $true $false),
    (New-Paragraph $xml '"test:selenium": "node --test tests/selenium/app.test.mjs",' "" $false $true),
    (New-Paragraph $xml '"test:selenium:local": "node tests/selenium/run-local.mjs"' "" $false $true),
    (New-Paragraph $xml "Selenium setup and browser configuration excerpt:" "" $true $false),
    (New-Paragraph $xml 'import { Builder, By, Key, until } from "selenium-webdriver";' "" $false $true),
    (New-Paragraph $xml 'import chrome from "selenium-webdriver/chrome.js";' "" $false $true),
    (New-Paragraph $xml 'const BASE_URL = process.env.SELENIUM_BASE_URL || "http://127.0.0.1:3000";' "" $false $true),
    (New-Paragraph $xml 'const BROWSER = process.env.SELENIUM_BROWSER || "chrome";' "" $false $true),
    (New-Paragraph $xml 'const HEADLESS = process.env.SELENIUM_HEADED !== "1";' "" $false $true),
    (New-Paragraph $xml 'const builder = new Builder().forBrowser(BROWSER);' "" $false $true),
    (New-Paragraph $xml 'const options = new chrome.Options().windowSize({ width: 1280, height: 900 });' "" $false $true),
    (New-Paragraph $xml 'options.addArguments("--headless=new", "--disable-gpu", "--no-sandbox");' "" $false $true),
    (New-Paragraph $xml "Route-protection test excerpt:" "" $true $false),
    (New-Paragraph $xml 'const protectedRoutes = ["/dashboard", "/discover", "/admin", "/verification-status", "/document/new"];' "" $false $true),
    (New-Paragraph $xml 'for (const route of protectedRoutes) {' "" $false $true),
    (New-Paragraph $xml '  it(`redirects unauthenticated users away from ${route}`, async () => {' "" $false $true),
    (New-Paragraph $xml '    await openApp(driver, route);' "" $false $true),
    (New-Paragraph $xml '    await waitForPath(driver, "/");' "" $false $true),
    (New-Paragraph $xml '    await waitForText(driver, "Student Sign In");' "" $false $true),
    (New-Paragraph $xml '  });' "" $false $true),
    (New-Paragraph $xml '}' "" $false $true),
    (New-Paragraph $xml "Responsive layout assertion excerpt:" "" $true $false),
    (New-Paragraph $xml 'async function assertNoHorizontalOverflow(driver) {' "" $false $true),
    (New-Paragraph $xml '  const hasOverflow = await driver.executeScript(' "" $false $true),
    (New-Paragraph $xml '    "return document.documentElement.scrollWidth > window.innerWidth + 1;",' "" $false $true),
    (New-Paragraph $xml '  );' "" $false $true),
    (New-Paragraph $xml '  assert.equal(hasOverflow, false);' "" $false $true),
    (New-Paragraph $xml '}' "" $false $true),
    (New-Paragraph $xml "Final Selenium execution output:" "" $true $false),
    (New-Paragraph $xml "Command: npm.cmd run test:selenium:local" "" $false $true),
    (New-Paragraph $xml "Total Selenium test cases: 19" "" $false $true),
    (New-Paragraph $xml "Passed: 19" "" $false $true),
    (New-Paragraph $xml "Failed: 0" "" $false $true),
    (New-Paragraph $xml "Skipped: 0" "" $false $true),
    (New-Paragraph $xml "Pass rate: 100%" "" $false $true)
  )

  Insert-AfterText $xml $ns "Torvalds, L. (2005) Git Version Control System." @(
    (New-Paragraph $xml "SeleniumHQ (no date) Selenium WebDriver Documentation. Available at: https://www.selenium.dev/documentation/webdriver/ (Accessed: 21 April 2026)." "" $false $false)
  )

  $settings = New-Object System.Xml.XmlWriterSettings
  $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
  $settings.OmitXmlDeclaration = $false
  $settings.Indent = $false
  $memory = New-Object System.IO.MemoryStream
  $writer = [System.Xml.XmlWriter]::Create($memory, $settings)
  $xml.Save($writer)
  $writer.Close()

  $entry.Delete()
  $newEntry = $zip.CreateEntry("word/document.xml")
  $entryStream = $newEntry.Open()
  try {
    $memory.Position = 0
    $memory.CopyTo($entryStream)
  } finally {
    $entryStream.Dispose()
    $memory.Dispose()
  }
} finally {
  $zip.Dispose()
}

$outputFull = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = [System.IO.Path]::GetDirectoryName($outputFull)
if (-not [System.IO.Directory]::Exists($outputDir)) {
  [System.IO.Directory]::CreateDirectory($outputDir) | Out-Null
}
[System.IO.File]::Copy($tempPath, $outputFull, $true)
Remove-Item -LiteralPath $tempPath -Force

Write-Output "Updated thesis written to: $outputFull"
