declare module '@3d-dice/dice-box' {
  type DiceBoxConfig = {
    container: string | HTMLElement;
    assetPath: string;
    theme?: string;
    themeColor?: string;
    offscreen?: boolean;
    enableShadows?: boolean;
    suspendSimulation?: boolean;
  };

  export default class DiceBox {
    constructor(selector: string, config: Omit<DiceBoxConfig, 'container'>);
    constructor(config: DiceBoxConfig);
    init(): Promise<DiceBox>;
    roll(notation: string): Promise<unknown>;
    clear(): DiceBox;
  }
}
