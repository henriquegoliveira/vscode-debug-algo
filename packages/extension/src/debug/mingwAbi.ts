import type { DebugConfiguration } from 'vscode';

export const MINGW_ABI_COMMAND = 'settings set plugin.object-file.pe-coff.abi gnu';

export function withMingwAbi(config: DebugConfiguration, platform: string): DebugConfiguration {
  if (platform !== 'win32' || config.type !== 'lldb') {
    return config;
  }

  const commands: unknown = config.initCommands;
  const own: unknown[] = Array.isArray(commands) ? commands : [];
  if (own.includes(MINGW_ABI_COMMAND)) {
    return config;
  }

  return { ...config, initCommands: [MINGW_ABI_COMMAND, ...own] };
}
