const fs = require('fs');
const files = ['src/components/AdminPortal/AdminPortalRoot.tsx', 'src/components/OpeningFlowView.tsx', 'src/components/WorkersModule/WorkersModuleView.tsx', 'src/data/mockQuarterLessons.ts', 'src/data/randomDemoGenerators.ts', 'src/services/dataBackupService.ts'];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/passwordHash\s*:\s*[^,}]+,?/g, '');
    fs.writeFileSync(f, c);
  }
});
