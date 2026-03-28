const test = require('node:test');
const assert = require('node:assert/strict');

const {
  briefingNeedsLanguageNormalization,
  summaryNeedsLanguageNormalization
} = require('../../services/briefing-language-service');

test('briefingNeedsLanguageNormalization detects English narrative inside a Chinese briefing target', () => {
  const needsNormalization = briefingNeedsLanguageNormalization({
    fit_summary: 'The candidate has strong blockchain engineering experience and product delivery exposure.',
    relevant_experience: [
      'Built Solana integrations and trading workflows.',
      'Led backend API development in Go.'
    ],
    employment_history: [
      {
        job_title: 'Blockchain Engineer',
        responsibilities: [
          'Built smart contract integrations and on-chain transaction workflows.'
        ]
      }
    ]
  }, 'zh');

  assert.equal(needsNormalization, true);
});

test('briefingNeedsLanguageNormalization leaves a Chinese briefing alone for a Chinese target', () => {
  const needsNormalization = briefingNeedsLanguageNormalization({
    fit_summary: '候选人在区块链工程和产品交付方面具备较强经验。',
    relevant_experience: [
      '负责 Solana 集成与交易工作流开发。',
      '主导 Go 后端 API 研发。'
    ],
    employment_history: [
      {
        job_title: '区块链工程师',
        responsibilities: [
          '构建智能合约集成与链上交易工作流。'
        ]
      }
    ]
  }, 'zh');

  assert.equal(needsNormalization, false);
});

test('summaryNeedsLanguageNormalization detects Chinese recruiter summary content for an English target', () => {
  const needsNormalization = summaryNeedsLanguageNormalization([
    '### 候选人： Noah Zhang',
    '目标职位：块链开发工程师 (Blockchain Developer)',
    '',
    '## Fit Summary',
    '- 具备扎实的 Go 语言基础，熟悉 Go 的核心库和框架（如 Gin/go-zero）。',
    '',
    '## Relevant Experience',
    '- 软件工程师，负责构建核心订单处理服务。'
  ].join('\n'), 'en');

  assert.equal(needsNormalization, true);
});
