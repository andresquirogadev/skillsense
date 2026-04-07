import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export type AgentName = 'claude-code' | 'opencode' | 'copilot' | 'vs-code' | 'unknown';

export interface AgentInfo {
  name: AgentName;
  displayName: string;
  skillsDir: string;
}

interface AgentSignature {
  readonly file: string;
  readonly agent: AgentName;
}

const AGENT_SIGNATURES: AgentSignature[] = [
  { file: '.claude', agent: 'claude-code' },
  { file: '.opencode', agent: 'opencode' },
  { file: '.github/copilot-instructions.md', agent: 'copilot' },
  { file: '.vscode', agent: 'vs-code' },
];

const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
  copilot: 'GitHub Copilot',
  'vs-code': 'VS Code',
  unknown: 'Unknown',
};

function localSkillsDir(agent: AgentName, cwd: string): string {
  switch (agent) {
    case 'claude-code':
      return join(cwd, '.claude', 'skills');
    case 'opencode':
      return join(cwd, '.opencode', 'skills');
    case 'copilot':
    case 'vs-code':
      return join(cwd, '.github', 'skills');
    default:
      return join(cwd, '.claude', 'skills');
  }
}

function globalSkillsDir(agent: AgentName): string {
  const home = homedir();
  switch (agent) {
    case 'claude-code':
      return join(home, '.claude', 'skills');
    case 'opencode':
      return join(home, '.opencode', 'skills');
    case 'copilot':
    case 'vs-code':
      return join(home, '.github', 'skills');
    default:
      return join(home, '.claude', 'skills');
  }
}

export function detectAgent(cwd: string): AgentName {
  for (const { file, agent } of AGENT_SIGNATURES) {
    if (existsSync(join(cwd, file))) return agent;
  }
  return 'unknown';
}

export function getAgentInfo(
  cwd: string,
  options: { agent?: string; global?: boolean } = {},
): AgentInfo {
  let agentName: AgentName;

  if (options.agent) {
    // Validate the provided agent name
    const valid: AgentName[] = ['claude-code', 'opencode', 'copilot', 'vs-code'];
    agentName = valid.includes(options.agent as AgentName)
      ? (options.agent as AgentName)
      : 'claude-code';
  } else {
    agentName = detectAgent(cwd);
    if (agentName === 'unknown') agentName = 'claude-code';
  }

  const skillsDir = options.global ? globalSkillsDir(agentName) : localSkillsDir(agentName, cwd);

  return {
    name: agentName,
    displayName: AGENT_DISPLAY_NAMES[agentName],
    skillsDir,
  };
}
