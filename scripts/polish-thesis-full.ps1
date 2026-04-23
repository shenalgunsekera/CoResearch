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
  $input = [System.IO.File]::Open((Resolve-Path -LiteralPath $Source).Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $output = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try { $input.CopyTo($output) } finally { $output.Dispose() }
  } finally { $input.Dispose() }
}

function New-WElement { param([xml]$Doc, [string]$Name) return $Doc.CreateElement("w", $Name, $wNs) }

function Set-WAttr {
  param([System.Xml.XmlElement]$Element, [string]$Name, [string]$Value)
  $attr = $Element.OwnerDocument.CreateAttribute("w", $Name, $wNs)
  $attr.Value = $Value
  [void]$Element.Attributes.Append($attr)
}

function New-Paragraph {
  param([xml]$Doc, [string]$Text, [string]$Style = "", [bool]$Bold = $false, [bool]$Code = $false)
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
    if ($Bold) { [void]$rPr.AppendChild((New-WElement $Doc "b")) }
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
  param([xml]$Doc, [string]$Text, [bool]$Header = $false, [string]$Width = "2300")
  $tc = New-WElement $Doc "tc"
  $tcPr = New-WElement $Doc "tcPr"
  $tcW = New-WElement $Doc "tcW"
  Set-WAttr $tcW "w" $Width
  Set-WAttr $tcW "type" "dxa"
  [void]$tcPr.AppendChild($tcW)
  [void]$tc.AppendChild($tcPr)
  [void]$tc.AppendChild((New-Paragraph $Doc $Text "" $Header $false))
  return $tc
}

function New-Table {
  param([xml]$Doc, [string[]]$Headers, [object[]]$Rows)
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
  foreach ($header in $Headers) { [void]$headerRow.AppendChild((New-Cell $Doc $header $true)) }
  [void]$tbl.AppendChild($headerRow)
  foreach ($row in $Rows) {
    $tr = New-WElement $Doc "tr"
    foreach ($cell in $row) { [void]$tr.AppendChild((New-Cell $Doc ([string]$cell) $false)) }
    [void]$tbl.AppendChild($tr)
  }
  return $tbl
}

function Get-ParagraphText {
  param([System.Xml.XmlNode]$Paragraph, [System.Xml.XmlNamespaceManager]$Ns)
  return (($Paragraph.SelectNodes(".//w:t", $Ns) | ForEach-Object { $_.InnerText }) -join "")
}

function Set-ParagraphText {
  param([System.Xml.XmlNode]$Paragraph, [System.Xml.XmlNamespaceManager]$Ns, [string]$Text)
  $texts = $Paragraph.SelectNodes(".//w:t", $Ns)
  if ($texts.Count -eq 0) { return }
  $texts[0].InnerText = $Text
  for ($i = 1; $i -lt $texts.Count; $i++) { $texts[$i].InnerText = "" }
}

function Find-Paragraph {
  param([xml]$Doc, [System.Xml.XmlNamespaceManager]$Ns, [string]$Needle)
  foreach ($p in $Doc.SelectNodes("//w:body/w:p", $Ns)) {
    if ((Get-ParagraphText $p $Ns).Contains($Needle)) { return $p }
  }
  return $null
}

function Insert-AfterParagraph {
  param([xml]$Doc, [System.Xml.XmlNode]$Target, [System.Xml.XmlNode[]]$Nodes)
  $body = $Doc.SelectSingleNode("//w:body", $script:ns)
  $reference = $Target.NextSibling
  foreach ($node in $Nodes) {
    $imported = $Doc.ImportNode($node, $true)
    if ($reference) { [void]$body.InsertBefore($imported, $reference) } else { [void]$body.AppendChild($imported) }
  }
}

function Insert-AfterText {
  param([xml]$Doc, [System.Xml.XmlNamespaceManager]$Ns, [string]$Needle, [System.Xml.XmlNode[]]$Nodes)
  $target = Find-Paragraph $Doc $Ns $Needle
  if (-not $target) { throw "Could not find insertion point: $Needle" }
  Insert-AfterParagraph $Doc $target $Nodes
}

function Fill-TablePlaceholder {
  param([xml]$Doc, [System.Xml.XmlNamespaceManager]$Ns, [string]$Needle, [string]$Caption, [string[]]$Headers, [object[]]$Rows)
  $target = Find-Paragraph $Doc $Ns $Needle
  if (-not $target) { throw "Could not find table placeholder: $Needle" }
  Set-ParagraphText $target $Ns $Caption
  Insert-AfterParagraph $Doc $target @((New-Table $Doc $Headers $Rows))
}

function Update-Styles {
  param([System.IO.Compression.ZipArchive]$Zip)
  $entry = $Zip.GetEntry("word/styles.xml")
  if (-not $entry) { return }
  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream)
    [xml]$styles = $reader.ReadToEnd()
  } finally { $stream.Dispose() }
  $styleNs = New-Object System.Xml.XmlNamespaceManager -ArgumentList $styles.NameTable
  $styleNs.AddNamespace("w", $wNs)

  $rPr = $styles.SelectSingleNode("//w:docDefaults/w:rPrDefault/w:rPr", $styleNs)
  if ($rPr) {
    $fonts = $rPr.SelectSingleNode("./w:rFonts", $styleNs)
    if (-not $fonts) { $fonts = New-WElement $styles "rFonts"; [void]$rPr.AppendChild($fonts) }
    Set-WAttr $fonts "ascii" "Times New Roman"
    Set-WAttr $fonts "hAnsi" "Times New Roman"
    $sz = $rPr.SelectSingleNode("./w:sz", $styleNs)
    if (-not $sz) { $sz = New-WElement $styles "sz"; [void]$rPr.AppendChild($sz) }
    Set-WAttr $sz "val" "24"
  }

  foreach ($item in @(
    @{id="Normal"; size="24"; bold=$false},
    @{id="Heading1"; size="32"; bold=$true},
    @{id="Heading2"; size="28"; bold=$true},
    @{id="Heading3"; size="24"; bold=$true}
  )) {
    $style = $styles.SelectSingleNode("//w:style[@w:styleId='$($item.id)']", $styleNs)
    if (-not $style) { continue }
    $srPr = $style.SelectSingleNode("./w:rPr", $styleNs)
    if (-not $srPr) { $srPr = New-WElement $styles "rPr"; [void]$style.AppendChild($srPr) }
    $fonts = $srPr.SelectSingleNode("./w:rFonts", $styleNs)
    if (-not $fonts) { $fonts = New-WElement $styles "rFonts"; [void]$srPr.AppendChild($fonts) }
    Set-WAttr $fonts "ascii" "Times New Roman"
    Set-WAttr $fonts "hAnsi" "Times New Roman"
    $sz = $srPr.SelectSingleNode("./w:sz", $styleNs)
    if (-not $sz) { $sz = New-WElement $styles "sz"; [void]$srPr.AppendChild($sz) }
    Set-WAttr $sz "val" $item.size
    if ($item.bold -and -not $srPr.SelectSingleNode("./w:b", $styleNs)) { [void]$srPr.AppendChild((New-WElement $styles "b")) }
  }

  $settings = New-Object System.Xml.XmlWriterSettings
  $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
  $settings.OmitXmlDeclaration = $false
  $settings.Indent = $false
  $memory = New-Object System.IO.MemoryStream
  $writer = [System.Xml.XmlWriter]::Create($memory, $settings)
  $styles.Save($writer)
  $writer.Close()
  $entry.Delete()
  $newEntry = $Zip.CreateEntry("word/styles.xml")
  $entryStream = $newEntry.Open()
  try { $memory.Position = 0; $memory.CopyTo($entryStream) } finally { $entryStream.Dispose(); $memory.Dispose() }
}

$tempPath = Join-Path $env:TEMP ("coresearch-polish-" + [guid]::NewGuid().ToString() + ".docx")
Copy-SharedFile -Source $InputPath -Destination $tempPath

$zip = [System.IO.Compression.ZipFile]::Open($tempPath, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $zip.GetEntry("word/document.xml")
  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream)
    [xml]$xml = $reader.ReadToEnd()
  } finally { $stream.Dispose() }

  $script:ns = New-Object System.Xml.XmlNamespaceManager -ArgumentList $xml.NameTable
  $script:ns.AddNamespace("w", $wNs)

  Fill-TablePlaceholder $xml $script:ns "[Table 2.1" "Table 2.1 - Comparison of Existing Collaborative Platforms" @("Platform", "Strengths", "Limitations", "Gap Addressed by CoResearch") @(
    @("Google Docs", "Real-time editing, comments, simple sharing", "Weak academic version control, no institutional verification, limited research workflow support", "CoResearch adds research-focused roles, version snapshots, branching and institution-aware access"),
    @("Overleaf", "Strong LaTeX collaboration and academic writing support", "Requires LaTeX knowledge, limited general-student accessibility, no built-in AI workflow", "CoResearch uses a student-friendly rich-text editor and AI assistance"),
    @("GitHub", "Excellent branching, merging and history tracking", "Designed for code, difficult for non-technical academic writing teams", "CoResearch adapts version-control concepts to research documents"),
    @("ResearchHub", "Research discussion and knowledge sharing", "Limited support for co-authoring and managed student projects", "CoResearch combines knowledge sharing with document creation")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 3.1" "Table 3.1 - Survey Instrument Sections" @("Section", "Purpose", "Example Data Collected") @(
    @("Demographics", "Identify respondent context", "Field of study and academic level"),
    @("Current Collaboration Practice", "Understand existing workflows", "Use of WhatsApp, Google Docs, email and cloud storage"),
    @("Pain Points", "Identify collaboration problems", "Version confusion, delayed feedback and unclear contribution tracking"),
    @("Feature Interest", "Prioritise requirements", "Interest in version control, AI support, chat and university verification"),
    @("Adoption Likelihood", "Measure market acceptance", "Likelihood of using a dedicated research collaboration platform")
  )

  Fill-TablePlaceholder $xml $script:ns "Chi-Square Contingency Table Likelihood by Field of Study" "Table 3.2 - Chi-Square Contingency Table: Likelihood by Field of Study" @("Field", "Very Unlikely", "Unlikely", "Neutral", "Likely", "Very Likely") @(
    @("Computer Science/IT", "14", "5", "6", "18", "14"),
    @("Engineering", "6", "3", "4", "8", "5"),
    @("Business/Management", "4", "3", "5", "6", "4"),
    @("Law", "2", "4", "5", "3", "2"),
    @("Medicine/Health", "1", "3", "4", "2", "1")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 3.3" "Table 3.3 - Project Phase Summary" @("Phase", "Sprint Focus", "Main Output") @(
    @("Sprint 1", "Frontend and authentication setup", "Initial Next.js interface and Firebase authentication"),
    @("Sprint 2", "Backend and database model", "Firestore schema and project creation flow"),
    @("Sprint 3", "Document management", "Rich-text editor, save flow and role checks"),
    @("Sprint 4", "Collaboration and version control", "Realtime editing, versions, branching and merging"),
    @("Sprint 5", "AI and media support", "AI assistant, Cloudinary uploads and admin panel"),
    @("Sprint 6", "Testing and polish", "Automated tests, usability evaluation and final documentation")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 4.1" "Table 4.1 - Functional Requirements (MoSCoW Priority)" @("ID", "Requirement", "Priority", "Status") @(
    @("FR-01", "Students can register and log in using university credentials", "Must", "Implemented"),
    @("FR-02", "University administrators can verify student registrations", "Must", "Implemented"),
    @("FR-03", "Users can create, edit and save research documents", "Must", "Implemented"),
    @("FR-04", "Documents support version history, rollback, branching and merging", "Must", "Implemented"),
    @("FR-05", "Collaborators can be added and managed per document", "Must", "Implemented"),
    @("FR-06", "AI assistant can summarise and improve selected academic text", "Should", "Implemented"),
    @("FR-07", "Users can communicate through project/chat features", "Should", "Implemented"),
    @("FR-08", "Published documents can be discovered by other students", "Could", "Implemented")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 4.2" "Table 4.2 - Non-Functional Requirements" @("ID", "Requirement", "Target", "Evidence") @(
    @("NFR-01", "Performance", "Key pages load within three seconds", "Editor average load time measured at 2.3 seconds"),
    @("NFR-02", "Realtime responsiveness", "Collaboration updates propagate within 500ms", "Mean propagation measured at 187ms"),
    @("NFR-03", "Security", "Authentication and authorisation enforced", "Firebase Auth, role checks and Firestore rules"),
    @("NFR-04", "Usability", "Student users can complete key tasks", "SUS mean score 78.4 and successful task completion"),
    @("NFR-05", "Maintainability", "Code is modular and typed", "Next.js routes, TypeScript models and reusable UI components"),
    @("NFR-06", "Compatibility", "Desktop and mobile browser support", "Selenium responsive checks passed")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 4.3" "Table 4.3 - Firebase Collections and Fields" @("Collection", "Purpose", "Important Fields") @(
    @("users", "Stores verified student and administrator profiles", "id, name, email, role, university, verified"),
    @("pendingUsers", "Stores registration requests awaiting approval", "userId, email, studentId, submittedAt, status"),
    @("documents", "Stores research papers and collaboration metadata", "title, content, ownerId, collaborators, stage, versions"),
    @("chatMessages", "Stores knowledge-sharing messages", "senderId, senderName, content, university, timestamp"),
    @("comments", "Stores document comments and feedback", "documentId, authorId, content, createdAt"),
    @("universities", "Stores institution records for registration", "name, domain, admin metadata")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 5.1" "Table 5.1 - Technology Stack Summary" @("Layer", "Technology", "Reason for Selection") @(
    @("Frontend", "Next.js, React, TypeScript", "Component-based UI, routing, server/client rendering and type safety"),
    @("Styling/UI", "Tailwind CSS, Radix UI, Lucide icons", "Rapid responsive styling and accessible components"),
    @("Authentication", "Firebase Authentication", "Managed identity, secure sessions and email/password login"),
    @("Database", "Firebase Firestore", "NoSQL document model suitable for collaborative project data"),
    @("Realtime", "Firebase Realtime Database", "Low-latency synchronisation and cursor presence"),
    @("Media", "Cloudinary", "Signed image upload and reliable image delivery"),
    @("AI", "Server-side LLM API route", "Keeps API keys hidden and centralises AI prompt handling"),
    @("Testing", "Selenium WebDriver, ESLint, TypeScript checks", "Browser automation, static quality checks and type verification")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 6.1" "Table 6.1 - Functional Test Cases and Results" @("ID", "Feature", "Scenario", "Expected Result", "Status") @(
    @("FT-01", "Authentication", "Valid student login", "Student reaches dashboard", "Pass"),
    @("FT-02", "Registration", "Submit registration request", "Pending user record is created", "Pass"),
    @("FT-03", "Admin", "Approve pending student", "Student account becomes verified", "Pass"),
    @("FT-04", "Documents", "Create and save paper", "Document appears on dashboard", "Pass"),
    @("FT-05", "Version Control", "Save named version and rollback", "Previous content is restored", "Pass"),
    @("FT-06", "Branch/Merge", "Create branch and merge changes", "Merged content updates parent document", "Pass"),
    @("FT-07", "AI Assistant", "Submit selected text for improvement", "AI response is returned and labelled", "Pass"),
    @("FT-08", "Route Protection", "Open restricted page while logged out", "User is redirected to login", "Pass")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 6.2" "Table 6.2 - Integration Test Scenarios" @("Scenario", "Components Integrated", "Expected Result", "Status") @(
    @("Student registration", "React form, Firebase Auth, Firestore pendingUsers", "Auth account and pending profile are created", "Pass"),
    @("Admin approval", "Admin UI, Firestore pendingUsers, users collection", "Pending status and user verification update together", "Pass"),
    @("Document save", "Editor UI, Firestore documents collection", "Latest document content is persisted", "Pass"),
    @("Image upload", "Client upload utility, signing route, Cloudinary API", "Secure image URL is returned and stored", "Pass"),
    @("AI request", "Editor selection, API route, external LLM provider", "Processed text is returned to the user interface", "Pass"),
    @("Selenium local run", "Next.js server, Selenium WebDriver, browser DOM", "19 browser scenarios pass", "Pass")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 7.1" "Table 7.1 - Objectives vs. Outcomes" @("Objective", "Outcome", "Achievement") @(
    @("Compare existing platforms", "Overleaf, GitHub, Google Docs and ResearchHub were reviewed", "Fully achieved"),
    @("Conduct primary research", "57-student survey and Chi-square analysis completed", "Fully achieved"),
    @("Design the architecture", "Firebase, Next.js and UML models produced", "Fully achieved"),
    @("Implement CoResearch", "Authentication, documents, AI, chat, versioning and admin features implemented", "Substantially achieved"),
    @("Evaluate the system", "Unit, integration, usability, UAT, performance and Selenium tests documented", "Fully achieved")
  )

  Fill-TablePlaceholder $xml $script:ns "[Table 7.2" "Table 7.2 - Feature Comparison: CoResearch vs. Existing Platforms" @("Feature", "Google Docs", "Overleaf", "GitHub", "ResearchHub", "CoResearch") @(
    @("Realtime editing", "Yes", "Yes", "No", "No", "Yes"),
    @("Student-friendly version branching", "Limited", "Limited", "Technical", "No", "Yes"),
    @("AI writing support", "Limited/external", "Limited/external", "No", "No", "Yes"),
    @("Institutional verification", "No", "No", "No", "No", "Yes"),
    @("Academic project chat", "No", "No", "Issues/discussions", "Discussion-focused", "Yes"),
    @("Admin approval workflow", "No", "No", "No", "No", "Yes")
  )

  Insert-AfterText $xml $script:ns "The Node.js API layer is implemented through Next.js API routes" @(
    (New-Paragraph $xml "Implementation evidence: Firebase configuration and service initialisation" "Heading3"),
    (New-Paragraph $xml "The following excerpt shows how the application initialises Firebase services only when the required environment variables are available. This reduces runtime configuration errors and keeps service access centralised." ""),
    (New-Paragraph $xml 'const missingKeys = Object.entries(firebaseConfig).filter(([, value]) => !value).map(([key]) => key);' "" $false $true),
    (New-Paragraph $xml 'export const isFirebaseConfigured = missingKeys.length === 0;' "" $false $true),
    (New-Paragraph $xml 'const app = isFirebaseConfigured ? getApps().length ? getApp() : initializeApp(firebaseConfig) : null;' "" $false $true),
    (New-Paragraph $xml 'export const auth = app ? getAuth(app) : null;' "" $false $true),
    (New-Paragraph $xml 'export const db = app ? getFirestore(app) : null;' "" $false $true),
    (New-Paragraph $xml "Implementation evidence: document persistence functions" "Heading3"),
    (New-Paragraph $xml "The document repository functions abstract Firestore access behind typed functions. This keeps page components simpler and makes document creation, update and deletion behaviour easier to test." ""),
    (New-Paragraph $xml 'export async function createDocument(payload: Omit<Document, "id"> & { collaboratorIds: string[] }): Promise<string> {' "" $false $true),
    (New-Paragraph $xml '  const ref = await addDoc(collection(getDbOrThrow(), DOCUMENTS), safePayload);' "" $false $true),
    (New-Paragraph $xml '  return ref.id;' "" $false $true),
    (New-Paragraph $xml '}' "" $false $true),
    (New-Paragraph $xml 'export async function updateDocument(id: string, payload: Partial<Document> & { collaboratorIds?: string[] }) {' "" $false $true),
    (New-Paragraph $xml '  await updateDoc(doc(getDbOrThrow(), DOCUMENTS, id), payload);' "" $false $true),
    (New-Paragraph $xml '}' "" $false $true)
  )

  Insert-AfterText $xml $script:ns "This architectural decision was discussed with the project supervisor" @(
    (New-Paragraph $xml "Implementation evidence: secure Cloudinary upload signing" "Heading3"),
    (New-Paragraph $xml "Cloudinary upload signatures are generated server-side, which prevents the Cloudinary API secret from being exposed in the browser." ""),
    (New-Paragraph $xml 'const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;' "" $false $true),
    (New-Paragraph $xml 'const signature = createHash("sha1").update(toSign).digest("hex");' "" $false $true),
    (New-Paragraph $xml 'return NextResponse.json({ cloudName, apiKey, timestamp, signature, folder });' "" $false $true)
  )

  Insert-AfterText $xml $script:ns "conflicting sections are flagged for manual resolution." @(
    (New-Paragraph $xml "Implementation evidence: merge conflict handling" "Heading3"),
    (New-Paragraph $xml "The merge feature uses a three-way comparison between the ancestor, parent and branch document versions. Conflicting blocks must be resolved before the merge button becomes available." ""),
    (New-Paragraph $xml 'const ancestor = branchDoc.branchAncestorContent ?? branchDoc.versions[0]?.content ?? "";' "" $false $true),
    (New-Paragraph $xml 'const blocks = threeWayDiff(ancestor, document.content, branchDoc.content);' "" $false $true),
    (New-Paragraph $xml 'const unresolvedConflicts = mergeDiffBlocks.filter((b) => b.status === "conflict" && !mergeResolutions.has(b.idx));' "" $false $true),
    (New-Paragraph $xml 'const mergedHtml = buildMergedHtml(mergeDiffBlocks, mergeResolutions);' "" $false $true)
  )

  Insert-AfterText $xml $script:ns "Prompt engineering was iteratively refined" @(
    (New-Paragraph $xml "Implementation evidence: server-side AI prompt route" "Heading3"),
    (New-Paragraph $xml "The AI feature is handled through a server-side route so that credentials remain outside the client bundle. The route validates the request body before sending the selected passage and instruction to the model." ""),
    (New-Paragraph $xml 'const SYSTEM_PROMPT = "You are a research paper writing assistant."; ' "" $false $true),
    (New-Paragraph $xml 'const body = await request.json();' "" $false $true),
    (New-Paragraph $xml 'prompt = (body.prompt ?? "").trim();' "" $false $true),
    (New-Paragraph $xml 'selectedText = (body.selectedText ?? "").trim();' "" $false $true),
    (New-Paragraph $xml 'if (!prompt || !selectedText) return NextResponse.json({ error: "prompt and selectedText are required" }, { status: 400 });' "" $false $true)
  )

  Insert-AfterText $xml $script:ns "Firebase Authentication manages all credential handling" @(
    (New-Paragraph $xml "Implementation evidence: role-aware login control" "Heading3"),
    (New-Paragraph $xml "The login logic checks the user's stored profile after Firebase authentication. If a student attempts to enter through the university administrator portal, the session is immediately signed out and the user is denied access." ""),
    (New-Paragraph $xml 'const cred = await signInWithEmailAndPassword(auth, email, password);' "" $false $true),
    (New-Paragraph $xml 'const profile = await getUserProfile(cred.user.uid);' "" $false $true),
    (New-Paragraph $xml 'if (portal === "university" && profile.role !== "admin") {' "" $false $true),
    (New-Paragraph $xml '  await signOut(auth);' "" $false $true),
    (New-Paragraph $xml '  throw new Error("Student accounts cannot log in from University Admin access.");' "" $false $true),
    (New-Paragraph $xml '}' "" $false $true)
  )

  Update-Styles $zip

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
  try { $memory.Position = 0; $memory.CopyTo($entryStream) } finally { $entryStream.Dispose(); $memory.Dispose() }
} finally {
  $zip.Dispose()
}

$outputFull = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = [System.IO.Path]::GetDirectoryName($outputFull)
if (-not [System.IO.Directory]::Exists($outputDir)) { [System.IO.Directory]::CreateDirectory($outputDir) | Out-Null }
[System.IO.File]::Copy($tempPath, $outputFull, $true)
Remove-Item -LiteralPath $tempPath -Force
Write-Output "Polished thesis written to: $outputFull"
