declare module "adm-zip" {
  export type AdmZipEntry = {
    entryName: string;
    isDirectory: boolean;
    getData(): Buffer;
  };

  export default class AdmZip {
    constructor(path?: string);
    addFile(entryName: string, content: Buffer): void;
    addLocalFile(filePath: string, zipPath?: string, zipName?: string): void;
    getEntries(): AdmZipEntry[];
    writeZip(targetFileName: string): void;
  }
}
