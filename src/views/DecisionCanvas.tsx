/**
 * DecisionCanvas Page
 * Single-screen compliance workstation with 3-column + workbench layout
 */

import { CanvasProvider } from '@app/contexts';
import {
  CanvasHeader,
  CanvasLayout,
  LeftRail,
  CenterPane,
  RightRail,
  BottomWorkbench,
} from '@app/layouts';

export function DecisionCanvas() {
  return (
    <CanvasProvider>
      <CanvasHeader />
      <CanvasLayout>
        <LeftRail />
        <CenterPane />
        <RightRail />
        <BottomWorkbench />
      </CanvasLayout>
    </CanvasProvider>
  );
}
