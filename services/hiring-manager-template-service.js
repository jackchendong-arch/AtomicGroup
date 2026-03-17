const fs = require('node:fs/promises');
const path = require('node:path');

const DocxtemplaterModule = require('docxtemplater');
const PizZip = require('pizzip');

const { extractCandidateName, extractRoleTitle } = require('./summary-service');

const Docxtemplater = DocxtemplaterModule.default || DocxtemplaterModule;

const SECTION_KEY_BY_HEADING = {
  Candidate: 'candidate_name',
  'Target Role': 'role_title',
  'Why This Candidate May Be a Fit': 'fit_summary',
  'Relevant Experience': 'relevant_experience',
  'Match Against Key Requirements': 'match_requirements',
  'Potential Concerns / Gaps': 'potential_concerns',
  'Recommended Next Step': 'recommended_next_step'
};

const SUPPORTED_WORD_TEMPLATE_TAGS = [
  'candidate_name',
  'hiring_manager',
  'role_title',
  'fit_summary',
  'relevant_experience',
  'match_requirements',
  'potential_concerns',
  'recommended_next_step',
  'candidate_summary',
  'candidate_gender',
  'candidate_nationality',
  'candidate_location',
  'candidate_preferred_location',
  'candidate_language_1',
  'candidate_language_2',
  'notice_period',
  'degree_name',
  'university',
  'start_year',
  'end_year',
  'job_title',
  'company_name',
  'start_date',
  'end_date',
  'job_responsibility_1',
  'job_responsibility_2',
  'generation_date',
  'generation_timestamp'
];

const TEMPLATE_TAG_ALIASES = {
  candidate_name: 'candidate_name',
  Candidate_Name: 'candidate_name',
  role_title: 'role_title',
  'Hiring Manager': 'hiring_manager',
  Candidate_Summary: 'candidate_summary',
  Canddidate_Gender: 'candidate_gender',
  Candidate_nationality: 'candidate_nationality',
  Candidate_Location: 'candidate_location',
  Candidate_Preferred_Location: 'candidate_preferred_location',
  'Candidate_Language 1': 'candidate_language_1',
  'Candidate_Language 2': 'candidate_language_2',
  Notice_Period: 'notice_period',
  Degree_Name: 'degree_name',
  University: 'university',
  'Start Year': 'start_year',
  End_Year: 'end_year',
  'Job Title': 'job_title',
  'Company Name': 'company_name',
  Start_date: 'start_date',
  End_Date: 'end_date',
  Job_responsibility_1: 'job_responsibility_1',
  Job_responsibility_2: 'job_responsibility_2'
};

const DOCX_MAIN_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const DOTX_MAIN_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml';
const DEGREE_LINE_PATTERN =
  /\b(bachelor|master|phd|doctor|mba|b\.?sc|m\.?sc|ba|ma|degree|diploma)\b/i;
const YEAR_RANGE_PATTERN =
  /((?:19|20)\d{2})(?:[./-]\d{1,2})?\s*[–-]\s*(Present|Current|Now|((?:19|20)\d{2})(?:[./-]\d{1,2})?)/i;
const EDUCATION_ORG_PATTERN = /\b(university|college|school|institute|academy)\b/i;
const SECTION_NAME_TO_KEY = {
  experience: 'experience',
  'employment experience': 'experience',
  'professional experience': 'experience',
  'project experience': 'experience',
  education: 'education',
  skills: 'skills',
  language: 'languages',
  languages: 'languages',
  availability: 'availability',
  'notice period': 'availability'
};

function normalizeTextBlock(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function splitNonEmptyLines(value) {
  return normalizeTextBlock(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeHeadingKey(value) {
  return normalizeTextBlock(value)
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanBulletPrefix(value) {
  return normalizeTextBlock(value).replace(/^[-*•]\s*/, '');
}

function isContactLine(value) {
  return /@|https?:\/\/|linkedin|^\+?[\d()\s-]{7,}$/.test(value);
}

function parseCvSections(cvText) {
  const lines = splitNonEmptyLines(cvText);
  const sections = {};
  let currentSection = null;

  for (const line of lines) {
    const sectionKey = SECTION_NAME_TO_KEY[normalizeHeadingKey(line)];

    if (sectionKey) {
      currentSection = sectionKey;
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  return {
    lines,
    sections
  };
}

function extractLabeledValue(lines, labels) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const label of labels) {
      const inlineMatch = line.match(new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*(.+)$`, 'i'));

      if (inlineMatch && inlineMatch[1]) {
        return inlineMatch[1].trim();
      }

      if (normalizeHeadingKey(line) === normalizeHeadingKey(label) && lines[index + 1]) {
        return lines[index + 1].trim();
      }
    }
  }

  return '';
}

function extractEarlyLocation(lines, candidateName) {
  for (const line of lines.slice(1, 8)) {
    if (!line || line === candidateName || isContactLine(line)) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(SECTION_NAME_TO_KEY, normalizeHeadingKey(line))) {
      continue;
    }

    if (line.split(/\s+/).length <= 6) {
      return line;
    }
  }

  return '';
}

function extractLanguageValues(lines, sectionLines = []) {
  const inlineValue = extractLabeledValue(lines, ['Languages', 'Language']);
  const rawValue = inlineValue || sectionLines.join(', ');

  if (!rawValue) {
    return ['', ''];
  }

  const values = rawValue
    .split(/[,/;|]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return [values[0] || '', values[1] || ''];
}

function extractEducationDetails(sectionLines = []) {
  const yearLine = sectionLines.find((line) => YEAR_RANGE_PATTERN.test(line)) || '';
  const yearMatch = yearLine.match(YEAR_RANGE_PATTERN);
  const startYear = yearMatch?.[1] || '';
  const endYear = yearMatch?.[3] || (yearMatch?.[2] && !/present|current|now/i.test(yearMatch[2]) ? yearMatch[2] : '');
  const degreeName = sectionLines.find((line) => DEGREE_LINE_PATTERN.test(line)) || '';
  const university = sectionLines.find((line) => EDUCATION_ORG_PATTERN.test(line)) || '';

  return {
    degreeName,
    university,
    startYear,
    endYear
  };
}

function extractDateRange(value) {
  const match = value.match(YEAR_RANGE_PATTERN);

  if (!match) {
    return {
      startDate: '',
      endDate: ''
    };
  }

  return {
    startDate: match[1] || '',
    endDate: match[2] || ''
  };
}

function splitRoleCompanyLine(value) {
  const normalized = normalizeTextBlock(value);

  if (!normalized) {
    return {
      jobTitle: '',
      companyName: ''
    };
  }

  const separators = [/\s+\|\s+/i, /\s+at\s+/i, /\s+@\s+/i];

  for (const separator of separators) {
    const parts = normalized.split(separator).map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
      return {
        jobTitle: parts[0],
        companyName: parts[1]
      };
    }
  }

  return {
    jobTitle: normalized,
    companyName: ''
  };
}

function extractExperienceDetails(sectionLines = []) {
  const bulletLines = sectionLines
    .filter((line) => /^[-*•]\s*/.test(line))
    .map(cleanBulletPrefix);
  const dateLineIndex = sectionLines.findIndex((line) => YEAR_RANGE_PATTERN.test(line));
  let titleLine = '';
  let dateLine = '';

  if (dateLineIndex >= 0) {
    dateLine = sectionLines[dateLineIndex];
    const neighbors = [
      sectionLines[dateLineIndex - 1],
      sectionLines[dateLineIndex + 1]
    ].filter(Boolean);

    titleLine = neighbors.find((line) => !/^[-*•]\s*/.test(line) && !YEAR_RANGE_PATTERN.test(line)) || '';
  }

  if (!titleLine) {
    titleLine = sectionLines.find((line) => {
      return line &&
        !/^[-*•]\s*/.test(line) &&
        !YEAR_RANGE_PATTERN.test(line) &&
        !DEGREE_LINE_PATTERN.test(line);
    }) || '';
  }

  const { jobTitle, companyName } = splitRoleCompanyLine(titleLine);
  const { startDate, endDate } = extractDateRange(dateLine);

  return {
    jobTitle,
    companyName,
    startDate,
    endDate,
    responsibility1: bulletLines[0] || '',
    responsibility2: bulletLines[1] || ''
  };
}

function extractHiringManagerTarget(jdText) {
  const lines = splitNonEmptyLines(jdText);
  return extractLabeledValue(lines, ['Hiring Manager', 'Company', 'Organization', 'Client', 'Employer']);
}

function extractRoleTitleFromJd(jdText, fileName) {
  const lines = splitNonEmptyLines(jdText);
  const labeledTitle = extractLabeledValue(lines, ['Job title', 'Role', 'Position', 'Title']);

  if (labeledTitle) {
    return labeledTitle;
  }

  const candidateLine = lines.find((line) => {
    return !/^(company|organization|client|employer|hiring manager)\s*:/i.test(line);
  });

  if (candidateLine) {
    return candidateLine;
  }

  return extractRoleTitle(jdText, fileName);
}

function extractDocumentDerivedProfile({ cvDocument, jdDocument }) {
  const cvText = cvDocument?.text || '';
  const jdText = jdDocument?.text || '';
  const { lines, sections } = parseCvSections(cvText);
  const candidateName = extractCandidateName(cvText, cvDocument?.file?.name || 'candidate');
  const roleTitle = extractRoleTitleFromJd(jdText, jdDocument?.file?.name || 'role');
  const [candidateLanguage1, candidateLanguage2] = extractLanguageValues(lines, sections.languages || []);
  const education = extractEducationDetails(sections.education || []);
  const experience = extractExperienceDetails(sections.experience || []);

  return {
    candidateName,
    roleTitle,
    hiringManager: extractHiringManagerTarget(jdText),
    candidateGender: extractLabeledValue(lines, ['Gender']),
    candidateNationality: extractLabeledValue(lines, ['Nationality']),
    candidateLocation:
      extractLabeledValue(lines, ['Current location', 'Location', 'Based in']) ||
      extractEarlyLocation(lines, candidateName),
    candidatePreferredLocation: extractLabeledValue(lines, ['Preferred location', 'Preferred Location']),
    candidateLanguage1,
    candidateLanguage2,
    noticePeriod: extractLabeledValue(lines, ['Notice period', 'Availability']) || (sections.availability || [])[0] || '',
    degreeName: education.degreeName,
    university: education.university,
    startYear: education.startYear,
    endYear: education.endYear,
    jobTitle: experience.jobTitle,
    companyName: experience.companyName,
    startDate: experience.startDate,
    endDate: experience.endDate,
    jobResponsibility1: experience.responsibility1,
    jobResponsibility2: experience.responsibility2
  };
}

function parseStructuredSummary(summary) {
  const sections = {};
  const lines = normalizeTextBlock(summary).split('\n');
  let currentKey = null;
  let currentBuffer = [];

  function flushSection() {
    if (!currentKey) {
      currentBuffer = [];
      return;
    }

    sections[currentKey] = normalizeTextBlock(currentBuffer.join('\n'));
    currentBuffer = [];
  }

  for (const line of lines) {
    const normalizedHeading = normalizeHeadingKey(line);
    const headingMatch = line.match(/^##+\s+(.+)$/);
    const headingSource = headingMatch ? headingMatch[1] : normalizedHeading;
    const sectionKey = SECTION_KEY_BY_HEADING[headingSource] || SECTION_KEY_BY_HEADING[line.replace(/^##+\s+/, '').trim()];

    if (headingMatch || (sectionKey && !/^[-*•]\s*/.test(line))) {
      flushSection();
      currentKey = sectionKey || null;
      continue;
    }

    if (currentKey) {
      currentBuffer.push(line);
    }
  }

  flushSection();
  return sections;
}

function buildTemplateData({ summary, cvDocument, jdDocument }) {
  const sections = parseStructuredSummary(summary);
  const profile = extractDocumentDerivedProfile({ cvDocument, jdDocument });
  const generationDate = new Date();
  const fitSummary = sections.fit_summary || normalizeTextBlock(summary);

  const baseData = {
    candidate_name: profile.candidateName,
    hiring_manager: profile.hiringManager,
    role_title: profile.roleTitle,
    fit_summary: fitSummary,
    relevant_experience: sections.relevant_experience || '',
    match_requirements: sections.match_requirements || '',
    potential_concerns: sections.potential_concerns || '',
    recommended_next_step: sections.recommended_next_step || '',
    candidate_summary: fitSummary,
    candidate_gender: profile.candidateGender,
    candidate_nationality: profile.candidateNationality,
    candidate_location: profile.candidateLocation,
    candidate_preferred_location: profile.candidatePreferredLocation,
    candidate_language_1: profile.candidateLanguage1,
    candidate_language_2: profile.candidateLanguage2,
    notice_period: profile.noticePeriod,
    degree_name: profile.degreeName,
    university: profile.university,
    start_year: profile.startYear,
    end_year: profile.endYear,
    job_title: profile.jobTitle,
    company_name: profile.companyName,
    start_date: profile.startDate,
    end_date: profile.endDate,
    job_responsibility_1: profile.jobResponsibility1,
    job_responsibility_2: profile.jobResponsibility2,
    generation_date: generationDate.toISOString().slice(0, 10),
    generation_timestamp: generationDate.toISOString()
  };

  return {
    ...baseData,
    Candidate_Name: baseData.candidate_name,
    'Hiring Manager': baseData.hiring_manager,
    Candidate_Summary: baseData.fit_summary,
    Canddidate_Gender: baseData.candidate_gender,
    Candidate_nationality: baseData.candidate_nationality,
    Candidate_Location: baseData.candidate_location,
    Candidate_Preferred_Location: baseData.candidate_preferred_location,
    'Candidate_Language 1': baseData.candidate_language_1,
    'Candidate_Language 2': baseData.candidate_language_2,
    Notice_Period: baseData.notice_period,
    Degree_Name: baseData.degree_name,
    University: baseData.university,
    'Start Year': baseData.start_year,
    End_Year: baseData.end_year,
    'Job Title': baseData.job_title,
    'Company Name': baseData.company_name,
    Start_date: baseData.start_date,
    End_Date: baseData.end_date,
    Job_responsibility_1: baseData.job_responsibility_1,
    Job_responsibility_2: baseData.job_responsibility_2
  };
}

function slugifyFilePart(value, fallback) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function buildSuggestedOutputFilename(templateData) {
  const candidatePart = slugifyFilePart(templateData.candidate_name, 'candidate');
  const rolePart = slugifyFilePart(templateData.role_title, 'role');
  return `${candidatePart}-${rolePart}-hiring-manager-summary.docx`;
}

function extractTextRunsFromXml(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"));
}

function extractTemplateTagsFromXml(xml) {
  const text = extractTextRunsFromXml(xml).join('');

  return [...new Set(
    [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)]
      .map((match) => match[1].trim())
      .filter(Boolean)
  )];
}

function getRelevantXmlFiles(zip) {
  return zip.file(/^(word\/document\.xml|word\/header\d+\.xml|word\/footer\d+\.xml)$/);
}

function inspectWordTemplate(zip) {
  const relevantFiles = getRelevantXmlFiles(zip);
  const detectedTags = [];

  for (const file of relevantFiles) {
    detectedTags.push(...extractTemplateTagsFromXml(file.asText()));
  }

  const uniqueDetectedTags = [...new Set(detectedTags)];
  const supportedDetectedTags = uniqueDetectedTags.filter((tag) => {
    return SUPPORTED_WORD_TEMPLATE_TAGS.includes(tag) || Object.prototype.hasOwnProperty.call(TEMPLATE_TAG_ALIASES, tag);
  });

  return {
    detectedTags: uniqueDetectedTags,
    supportedDetectedTags
  };
}

function assertTemplateSupportsOutput(templateInspection) {
  if (templateInspection.supportedDetectedTags.length > 0) {
    return;
  }

  if (templateInspection.detectedTags.length === 0) {
    throw new Error(
      `The configured Word template does not contain any supported placeholders. Add tags such as ${SUPPORTED_WORD_TEMPLATE_TAGS.map((tag) => `{{${tag}}}`).join(', ')}.`
    );
  }

  throw new Error(
    `The configured Word template contains placeholders, but none are supported by this app. Supported placeholders are ${SUPPORTED_WORD_TEMPLATE_TAGS.map((tag) => `{{${tag}}}`).join(', ')}. Detected placeholders: ${templateInspection.detectedTags.map((tag) => `{{${tag}}}`).join(', ')}.`
  );
}

function normalizeWordPackageForOutput(zip, sourceExtension) {
  if (sourceExtension !== '.dotx') {
    return;
  }

  const contentTypesFile = zip.file('[Content_Types].xml');

  if (!contentTypesFile) {
    throw new Error('The Word template package is missing [Content_Types].xml.');
  }

  const contentTypesXml = contentTypesFile.asText();
  const normalizedContentTypesXml = contentTypesXml.replace(DOTX_MAIN_CONTENT_TYPE, DOCX_MAIN_CONTENT_TYPE);

  zip.file('[Content_Types].xml', normalizedContentTypesXml);
}

function validateGeneratedWordDocument(buffer) {
  const zip = new PizZip(buffer);
  const contentTypesFile = zip.file('[Content_Types].xml');

  if (!contentTypesFile) {
    throw new Error('Generated Word package is missing [Content_Types].xml.');
  }

  const contentTypesXml = contentTypesFile.asText();

  if (!contentTypesXml.includes(DOCX_MAIN_CONTENT_TYPE)) {
    throw new Error('Generated Word package is missing the standard .docx main document content type.');
  }

  if (!zip.file('word/document.xml')) {
    throw new Error('Generated Word package is missing word/document.xml.');
  }
}

async function renderHiringManagerWordDocument({ templatePath, outputPath, templateData }) {
  const extension = path.extname(templatePath).toLowerCase();

  if (!['.docx', '.dotx'].includes(extension)) {
    throw new Error('Only .docx and .dotx hiring-manager templates are supported for automated output.');
  }

  const templateContent = await fs.readFile(templatePath);

  let document;
  let zip;

  try {
    zip = new PizZip(templateContent);
  } catch (error) {
    throw new Error(
      `The configured Word template could not be opened. Use a valid .docx or .dotx template. ${error.message}`
    );
  }

  const templateInspection = inspectWordTemplate(zip);
  assertTemplateSupportsOutput(templateInspection);

  try {
    document = new Docxtemplater(zip, {
      delimiters: {
        start: '{{',
        end: '}}'
      },
      paragraphLoop: true,
      linebreaks: true
    });
  } catch (error) {
    throw new Error(
      `The configured Word template could not be initialized for output rendering. ${error.message}`
    );
  }

  try {
    document.render(templateData);
  } catch (error) {
    const nestedErrors = error?.properties?.errors || [];
    const nestedMessages = nestedErrors
      .map((entry) => entry.properties?.explanation || entry.message)
      .filter(Boolean);

    throw new Error(
      [
        'The Word template could not be rendered.',
        nestedMessages[0] || error.message,
        'Supported placeholders: ' + SUPPORTED_WORD_TEMPLATE_TAGS.map((tag) => `{{${tag}}}`).join(', ')
      ].join(' ')
    );
  }

  normalizeWordPackageForOutput(document.getZip(), extension);

  const renderedBuffer = document.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });

  validateGeneratedWordDocument(renderedBuffer);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderedBuffer);

  return {
    outputPath,
    templateData
  };
}

module.exports = {
  SUPPORTED_WORD_TEMPLATE_TAGS,
  buildSuggestedOutputFilename,
  buildTemplateData,
  parseStructuredSummary,
  renderHiringManagerWordDocument
};
