const fs = require('fs');
let code = fs.readFileSync('src/components/MachineInspectionModal.tsx', 'utf8');

// 1. Convert constants to functions
code = code.replace(/const SCREW_CONFIGS: \{[^\}]+\}\[\] = \[/, 'const getScrewConfigs = (t: any): { id: ScrewType; name: string; tag: string; color: string }[] => [');
code = code.replace(/const MASTER_RAW_MATERIAL_PRESETS = \[/, 'const getMasterRawMaterialPresets = (t: any) => [');
code = code.replace(/const INITIAL_PRESET_MATERIALS: Record<ScrewType, MaterialItemState\[\]> = \{/, 'const getInitialPresetMaterials = (t: any): Record<ScrewType, MaterialItemState[]> => ({\n');
code = code.replace(/const PRESET_POSITIONS = \[/, 'const getPresetPositions = (t: any) => [');
code = code.replace(/i18next\.t\('ui_text_1786157472070_72'\)\r?\n\];/, "t('ui_text_1786157472070_72')\n];");
code = code.replace(/    \]\r?\n\};/, "    ]\n});"); 

// Fix Type for unit: string
code = code.replace(/unit: '包' \| 'kg';/, 'unit: string;');

// 2. Replace i18next.t with t inside these definitions
code = code.replace(/i18next\.t\(/g, 't(');

// 3. Update component state initializations
code = code.replace(/useState<string\[\]>\(MASTER_RAW_MATERIAL_PRESETS\)/, 'useState<string[]>(() => getMasterRawMaterialPresets(t))');
code = code.replace(/useState<Record<ScrewType, MaterialItemState\[\]>>\(INITIAL_PRESET_MATERIALS\)/, 'useState<Record<ScrewType, MaterialItemState[]>>(() => getInitialPresetMaterials(t))');

// 4. Update SCREW_CONFIGS references
code = code.replace(/SCREW_CONFIGS\.map/g, 'getScrewConfigs(t).map');
code = code.replace(/SCREW_CONFIGS\.find/g, 'getScrewConfigs(t).find');
code = code.replace(/SCREW_CONFIGS\[0\]/g, 'getScrewConfigs(t)[0]');

// 5. Update PRESET_POSITIONS references
code = code.replace(/PRESET_POSITIONS\.map/g, 'getPresetPositions(t).map');
code = code.replace(/PRESET_POSITIONS\.findIndex/g, 'getPresetPositions(t).findIndex');

fs.writeFileSync('src/components/MachineInspectionModal.tsx', code);
console.log('Fixed MachineInspectionModal');
