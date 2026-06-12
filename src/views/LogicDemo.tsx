import { useState, useMemo } from 'react';
import { DecisionTreeViewer, evaluateTree } from '@features/decision-tree';
import { TraceExplorer } from '@features/trace-explorer';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@shared/ui';
import { MICA_STABLECOIN_RULE } from '@features/decision-tree/data';
import type { DecisionNode } from '@/types/decisionTree';

// Sample facts for demo
const SAMPLE_FACTS = {
  stablecoin_emt: {
    name: 'EUR Stablecoin (EMT)',
    facts: {
      instrument: {
        type: 'stablecoin',
        reference_asset: 'fiat_single',
        reserve_value_eur: 1000000000,
      },
      issuer: {
        type: 'credit_institution',
      },
    },
  },
  stablecoin_significant: {
    name: 'Significant Stablecoin',
    facts: {
      instrument: {
        type: 'stablecoin',
        reference_asset: 'fiat_single',
        reserve_value_eur: 6000000000,
      },
      issuer: {
        type: 'new_entity',
      },
    },
  },
  art_token: {
    name: 'Asset-Referenced Token',
    facts: {
      instrument: {
        type: 'stablecoin',
        reference_asset: 'crypto_basket',
        market_cap_eur: 2000000000,
      },
      issuer: {
        type: 'new_entity',
      },
    },
  },
  not_stablecoin: {
    name: 'Utility Token',
    facts: {
      instrument: {
        type: 'utility_token',
      },
    },
  },
};

type ScenarioKey = keyof typeof SAMPLE_FACTS;

export function LogicDemo() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('stablecoin_emt');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Evaluate the tree with selected facts
  const { leaf, trace } = useMemo(() => {
    const scenario = SAMPLE_FACTS[selectedScenario];
    return evaluateTree(MICA_STABLECOIN_RULE.tree as DecisionNode, scenario.facts);
  }, [selectedScenario]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-blue-400">🧪</span>
            Logic Viewer Demo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">
            Explore how the MiCA Stablecoin Authorization rule evaluates different scenarios.
            Select a scenario to see the decision path highlighted in the tree.
          </p>

          {/* Scenario selector */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SAMPLE_FACTS) as [ScenarioKey, typeof SAMPLE_FACTS[ScenarioKey]][]).map(
              ([key, scenario]) => (
                <Button
                  key={key}
                  variant={selectedScenario === key ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedScenario(key)}
                >
                  {scenario.name}
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Facts display */}
      <Card variant="bordered">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Input Facts</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded bg-slate-900 p-3 text-xs text-slate-300 overflow-x-auto">
            {JSON.stringify(SAMPLE_FACTS[selectedScenario].facts, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Main visualization */}
      <div className="grid grid-cols-2 gap-6">
        {/* Decision Tree */}
        <DecisionTreeViewer
          tree={MICA_STABLECOIN_RULE.tree as DecisionNode}
          trace={trace}
          finalNode={leaf}
          title="MiCA Stablecoin Authorization"
          onNodeSelect={(node) => setHoveredNodeId(node.nodeId)}
        />

        {/* Trace Explorer */}
        <TraceExplorer
          trace={trace}
          finalNode={leaf}
          title="Evaluation Trace"
          highlightedNodeId={hoveredNodeId}
          onNodeHover={setHoveredNodeId}
        />
      </div>

      {/* Rule metadata */}
      <Card variant="bordered">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rule Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Rule ID:</span>
              <p className="text-white font-mono">{MICA_STABLECOIN_RULE.id}</p>
            </div>
            <div>
              <span className="text-slate-500">Version:</span>
              <p className="text-white">{MICA_STABLECOIN_RULE.version}</p>
            </div>
            <div>
              <span className="text-slate-500">Jurisdiction:</span>
              <p className="text-white">{MICA_STABLECOIN_RULE.metadata.jurisdiction}</p>
            </div>
            <div>
              <span className="text-slate-500">Framework:</span>
              <p className="text-white">{MICA_STABLECOIN_RULE.metadata.framework}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
