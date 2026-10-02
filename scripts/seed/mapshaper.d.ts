/** Types for the mapshaper calls that build the tract map. The package does not ship its own. */
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
