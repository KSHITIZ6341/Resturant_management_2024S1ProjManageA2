export interface ElectronWindowAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  subscribeToMaximize?: (callback: (state: boolean) => void) => void | (() => void);
}

declare global {
  interface Window {
    electronWindow?: ElectronWindowAPI;
  }
}

export {};
