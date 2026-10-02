declare module "mapshaper" {
  const mapshaper: {
    runCommands(commands: string): Promise<void>;
    applyCommands(
      commands: string,
      input?: Record<string, unknown>,
    ): Promise<Record<string, Buffer | string>>;
  };
  export default mapshaper;
}
