/** 代码块语言选项（id 对应 highlight.js 语言名） */
export const CODE_LANGUAGES: { id: string; label: string }[] = [
  { id: '', label: '纯文本' },
  { id: 'json', label: 'JSON' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'bash', label: 'Bash' },
  { id: 'csharp', label: 'C#' },
  { id: 'yaml', label: 'YAML' },
  { id: 'xml', label: 'XML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' },
  { id: 'dockerfile', label: 'Dockerfile' },
];

/** 下拉选项：保留文档里已有但不在预设中的语言 */
export function codeLanguageOptions(currentLang: string) {
  const options = [...CODE_LANGUAGES];
  if (currentLang && !options.some((item) => item.id === currentLang)) {
    options.splice(1, 0, { id: currentLang, label: currentLang });
  }
  return options;
}
