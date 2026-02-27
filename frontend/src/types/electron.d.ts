export interface ElectronWindowAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  openFilePath: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  subscribeToMaximize?: (callback: (state: boolean) => void) => void | (() => void);
}

declare global {
  interface Window {
    electronWindow?: ElectronWindowAPI;
  }
}

export {};
