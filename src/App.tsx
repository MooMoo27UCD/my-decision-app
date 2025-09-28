import React, { useMemo, useState } from "react";

type Matrix = number[][];
const RI_TABLE: Record<number, number> = {1:0,2:0,3:0.58,4:0.90,5:1.12,6:1.24,7:1.32,8:1.41,9:1.45,10:1.49};
const AHP_SCALE = [1/9,1/8,1/7,1/6,1/5,1/4,1/3,1/2,1,2,3,4,5,6,7,8,9];

const round = (x: number, d=3) => Number.isFinite(x) ? Number(x.toFixed(d)) : NaN;
const clampPos = (x: number) => (Number.isFinite(x) && x > 0 ? x : 1);

function normalizeColumns(A: Matrix): Matrix {
  const n = A.length;
  const colSums = Array(n).fill(0);
  for (let j=0;j<n;j++) for (let i=0;i<n;i++) colSums[j]+=A[i][j];
  return A.map(row => row.map((v,j)=> colSums[j] ? v/colSums[j] : 0));
}
function rowAverages(M: Matrix): number[] { return M.map(r => r.reduce((a,b)=>a+b,0) / (r.length||1)); }
function matVec(A: Matrix, w: number[]): number[] { return A.map(row => row.reduce((s,v,j)=> s + v*w[j], 0)); }
function consistencyRatio(A: Matrix, w: number[]) {
  const n = A.length; if (n<3) return { lambdaMax: NaN, CI: 0, CR: 0 };
  const y = matVec(A,w); const lambda = y.map((yi,i)=> yi/(w[i]||1e-12));
  const lambdaMax = lambda.reduce((a,b)=>a+b,0)/n;
  const CI = (lambdaMax - n)/(n-1); const RI = RI_TABLE[n] ?? RI_TABLE[10];
  return { lambdaMax, CI, CR: RI? CI/RI : 0 };
}
function erf(x: number){ const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911; const s=x<0?-1:1; x=Math.abs(x); const t=1/(1+p*x); const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x); return s*y; }

function Section({title, children}:{title:string; children:React.ReactNode}) {
  return <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><h2 className="text-xl font-semibold mb-3">{title}</h2>{children}</div>;
}
function NumInput({ value, onChange }: { value: number | string; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className="px-3 py-2 rounded-lg border border-slate-300 w-full"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
    />
  );
}

export default function App(){
  const [criteria, setCriteria] = useState<string[]>(["Cost","Performance","Reliability"]);
  const n = criteria.length;
  const [upper, setUpper] = useState<Record<string, number>>({"0-1":1/3,"0-2":1/5,"1-2":1/2});
  function setUpperVal(i:number,j:number,val:number){ setUpper(u=>({...u,[`${i}-${j}`]: clampPos(val)})); }
  const A: Matrix = useMemo(()=>{
    const M: Matrix = Array.from({length:n},()=>Array(n).fill(1));
    for (let i=0;i<n;i++) for (let j=i+1;j<n;j++){ const v=upper[`${i}-${j}`] ?? 1; M[i][j]=clampPos(v); M[j][i]=1/clampPos(v); }
    return M;
  },[n,upper]);

  const N = useMemo(()=>normalizeColumns(A),[A]);
  const weights = useMemo(()=>rowAverages(N),[N]);
  const { lambdaMax, CI, CR } = useMemo(()=>consistencyRatio(A,weights),[A,weights]);
  const topIdx = useMemo(() => {
    if (!weights.length) return 0;
    return weights.reduce((best, w, i) => (w > (weights[best] ?? -Infinity) ? i : best), 0);
  }, [weights]);

  type OptionRow = { name:string; scores:number[] };
  const [options, setOptions] = useState<OptionRow[]>([
    { name:"Option A", scores:[8,6,7] },
    { name:"Option B", scores:[6,9,8] },
    { name:"Option C", scores:[9,5,6] },
  ]);
  const weighted = useMemo(()=>{
    const rows = options.map(o=>{
      const parts = o.scores.map((s,i)=> s*(weights[i]||0));
      return { name:o.name, parts, total: parts.reduce((a,b)=>a+b,0) };
    });
    const ranked = [...rows].sort((a,b)=>b.total-a.total);
    return { rows, ranked };
  },[options,weights]);

  function addCriterion(){
    const name = prompt("New criterion name?"); if(!name) return;
    setCriteria(cs=>[...cs,name]);
    const idx = criteria.length;
    setUpper(u=>{ const c={...u}; for(let i=0;i<idx;i++) c[`${i}-${idx}`]=1; return c; });
    setOptions(opts=>opts.map(o=>({...o, scores:[...o.scores,1]})));
  }
  function removeCriterion(idx:number){
    if(criteria.length<=1) return;
    setCriteria(cs=>cs.filter((_,i)=>i!==idx));
    setUpper(u=>{
      const c:Record<string,number>={};
      Object.entries(u).forEach(([k,v])=>{
        const [i,j]=k.split("-").map(Number);
        if(i===idx||j===idx) return;
        const ii=i>idx?i-1:i, jj=j>idx?j-1:j; c[`${ii}-${jj}`]=v;
      });
      return c;
    });
    setOptions(opts=>opts.map(o=>{ const s=[...o.scores]; s.splice(idx,1); return {...o,scores:s}; }));
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 text-slate-900 p-6">
      <div className="max-w-6xl mx-auto grid gap-6">
        <header>
          <h1 className="text-3xl font-bold">My Decision App — AHP & Statistics</h1>
          <p className="text-slate-600 mt-1">Pairwise → weights → decision matrix → ranking. Then analyze with σ, z, and Φ(z).</p>
        </header>

        <Section title="How to use this app (quick guide)">
          <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
            <li><span className="font-medium">Define criteria</span> (e.g., Cost, Performance, Reliability). Add/remove as needed.</li>
            <li><span className="font-medium">Step 1 – Pairwise comparisons:</span> For each pair, choose how many times one is more important than the other using the 1–9 AHP scale (intermediates allowed). The lower triangle auto-fills with reciprocals.</li>
            <li><span className="font-medium">Check consistency (CR):</span> CR ≤ 0.10 is usually acceptable; higher means your judgments may conflict—tweak the pairwise values.</li>
            <li><span className="font-medium">Step 2 – Score options:</span> Give each option a numeric score for every criterion (higher = better unless you pre-transform a cost into a benefit score).</li>
            <li><span className="font-medium">Rank results:</span> We compute a weighted total from your AHP weights. Highest total wins.</li>
            <li><span className="font-medium">Extra – Stats:</span> We show mean, standard deviation, z-scores, and normal probabilities across the option totals to gauge how exceptional the leader is.</li>
          </ol>
        </Section>

        <Section title="Step 1 — Pairwise Comparison Matrix (AHP)">
          <div className="flex flex-wrap gap-2 mb-3">
            <button className="px-3 py-2 rounded-lg border bg-white" onClick={addCriterion}>+ Add Criterion</button>
            <div className="text-sm ml-auto">
              <span className={`px-2 py-1 rounded-md border ${CR<=0.1? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                CR: {round(CR,3)} {CR<=0.1? '• acceptable' : '• review'}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-3">
            For each upper‑triangle cell (row <em>i</em> vs column <em>j</em>), pick a ratio on the 1–9 AHP scale. We now allow reciprocals directly:
            <span className="font-mono">&nbsp;[1/9 … 1/2, 1, 2 … 9]</span>.
            Interpretation: values <span className="font-mono">&gt;1</span> mean the <strong>row</strong> is more important than the column; values <span className="font-mono">&lt;1</span> mean the <strong>row</strong> is less important (i.e., the column is more important). The diagonal is 1 and the lower triangle auto‑fills with reciprocals. Columns are normalized to sum to 1; row averages yield the final weights.
          </p>

          <div className="overflow-auto">
            <table className="min-w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Criteria</th>
                  {criteria.map((c,j)=>(
                    <th key={j} className="p-2 text-left">
                      <div className="flex items-center gap-2">
                        {c}
                        <button className="text-rose-600 text-xs" onClick={()=>removeCriterion(j)} title="remove">✕</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map((rowName,i)=>(
                  <tr key={i} className="odd:bg-white even:bg-slate-50">
                    <th className="p-2 text-left">{rowName}</th>
                    {criteria.map((_,j)=>{
                      if(i===j) return <td key={j} className="p-2 text-center">1</td>;
                      if(i<j){
                        const key=`${i}-${j}`; const v=upper[key]??1;
                        return (
                          <td key={j} className="p-2">
                            <div className="flex items-center gap-2">
                              <select
                                className="px-2 py-1 border rounded-md"
                                value={String(v)}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUpperVal(i, j, parseFloat(e.target.value))}
                              >
                                {AHP_SCALE.map((x)=> (
                                  <option key={x} value={x}>{Number(x).toPrecision(3).replace(/\.0+$/,'')}</option>
                                ))}
                              </select>
                              <span className="text-xs text-slate-500">row: {criteria[i]} vs col: {criteria[j]}</span>
                            </div>
                          </td>
                        );
                      } else {
                        const key=`${j}-${i}`; const v=upper[key]??1;
                        return <td key={j} className="p-2 text-center text-slate-600">{round(1/(v||1),3)}</td>;
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="overflow-auto">
              <div className="font-semibold mb-2">Normalized Matrix (columns sum to 1)</div>
              <table className="min-w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100">
                  <tr><th className="p-2 text-left">Criteria</th>{criteria.map((c,j)=><th key={j} className="p-2 text-left">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {normalizeColumns(A).map((row,i)=>(
                    <tr key={i} className="odd:bg-white even:bg-slate-50">
                      <th className="p-2 text-left">{criteria[i]}</th>
                      {row.map((x,j)=><td key={j} className="p-2">{round(x,3)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="font-semibold mb-2">Criteria Weights (row averages)</div>
              <ul className="grid gap-2">
                {rowAverages(normalizeColumns(A)).map((w,i)=>(
                  <li key={i} className="flex justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>{criteria[i]}</span><span className="font-semibold">{round(w,3)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-slate-600">
                λ<sub>max</sub> = {round(lambdaMax,3)} • CI = {round(CI,3)} • CR = {round(CR,3)} {CR<=0.1? "✅" : "⚠️"}
              </div>
              <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm">
                <div className="font-semibold mb-1">Example interpretation</div>
                <div>
                  Current most important criterion: <span className="font-medium">{criteria[topIdx]}</span> with weight <span className="font-mono">{round(weights[topIdx]||0,3)}</span>.
                  {" "}CR {CR<=0.1? 'is acceptable—your pairwise judgments are reasonably consistent.' : 'is high—consider revisiting pairwise inputs (e.g., if A>B and B>C, ensure A>C).'}
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Step 2 — Decision Matrix (Options × Criteria)">
          <p className="text-sm text-slate-600 mb-3">
            Enter raw scores for each option by criterion. Scores should be on a consistent scale (e.g., 1–10). We convert them to a weighted total using your AHP-derived weights. If a criterion is a cost (lower is better), either invert it into a benefit score before input (e.g., 10−costScaled) or define it so that higher means better (e.g., affordability).
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button className="px-3 py-2 rounded-lg border bg-white" onClick={()=>{
              const name=prompt("New option name?"); if(!name) return;
              setOptions(o=>[...o,{name,scores:Array(criteria.length).fill(1)}]);
            }}>+ Add Option</button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Option</th>
                  {criteria.map((c,i)=><th key={i} className="p-2 text-left">{c}</th>)}
                  <th className="p-2 text-left">Weighted Total</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {options.map((o,k)=>(
                  <tr key={k} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2">
                      <input
                        className="px-2 py-1 border rounded-md"
                        value={o.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setOptions(opts => opts.map((r, i) => (i === k ? { ...r, name: e.target.value } : r)))
                        }
                      />
                    </td>
                    {criteria.map((_,i)=>(
                      <td key={i} className="p-2">
                        <NumInput value={o.scores[i]} onChange={(v)=>setOptions(opts=>opts.map((r,ri)=>ri===k? {...r, scores: r.scores.map((s,si)=> si===i? (Number.isFinite(v)?v:0):s)}:r))} />
                      </td>
                    ))}
                    <td className="p-2 font-semibold">{round(weighted.rows[k].total,3)}</td>
                    <td className="p-2">
                      <button className="text-rose-600 text-xs" onClick={()=>setOptions(opts=>opts.filter((_,i)=>i!==k))}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <div className="font-semibold mb-2">Ranking (highest is best)</div>
            <ol className="list-decimal list-inside bg-white border border-slate-200 rounded-xl p-3">
              {weighted.ranked.map((r,idx)=>(
                <li key={idx} className="py-1 flex justify-between">
                  <span>{r.name}</span><span className="font-semibold">{round(r.total,3)}</span>
                </li>
              ))}
            </ol>
            {weighted.ranked.length>0 && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
                <div className="font-semibold mb-1">Example interpretation</div>
                <div>
                  Best option right now: <span className="font-medium">{weighted.ranked[0].name}</span> with total <span className="font-mono">{round(weighted.ranked[0].total,3)}</span>.
                  {weighted.ranked.length>1 && (
                    <> Next best is <span className="font-medium">{weighted.ranked[1].name}</span> at <span className="font-mono">{round(weighted.ranked[1].total,3)}</span>, a spread of <span className="font-mono">{round(weighted.ranked[0].total - weighted.ranked[1].total,3)}</span>.</>
                  )}
                  {" "}If the spread is small and CR is high, revisit pairwise judgments or rescore options.
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Extra — Standard Deviation, Z-Scores, Normal Probabilities">
          <StdZBlock finals={weighted.rows.map(r=>r.total)} names={options.map(o=>o.name)} />
        </Section>
      </div>
    </div>
  );
}

function StdZBlock({finals,names}:{finals:number[]; names:string[];}){
  const mean = finals.reduce((a,b)=>a+b,0)/(finals.length||1);
  const [useSample,setUseSample]=useState(true);
  const sd = useMemo(()=>{
    const n=finals.length; if(!n) return NaN;
    const denom = useSample? Math.max(1,n-1): n;
    const v = finals.reduce((a,x)=>a+(x-mean)*(x-mean),0)/denom;
    return Math.sqrt(v);
  },[finals,mean,useSample]);
  const rows = finals.map((v,i)=>{ const z=(v-mean)/(sd||1e-12); const cdf=0.5*(1+erf(z/Math.SQRT2)); return {name:names[i]??`Opt ${i+1}`, v, z, cdf, upper:1-cdf}; });

  return (
    <div>
      <p className="text-sm text-slate-600 mb-3">
        We treat the final weighted totals like a sample and compute mean (μ̂), standard deviation (s or σ), and z-scores z=(x−μ̂)/s. Φ(z) is the normal CDF—values near 1 indicate a result far above average. With few options, treat probabilities as rough guidance.
      </p>
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-xs uppercase text-slate-600 mb-1">Mean</div>
          <div className="text-2xl font-semibold">{round(mean,3)}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-xs uppercase text-slate-600 mb-1">Std Dev ({useSample?"sample":"population"})</div>
          <div className="text-2xl font-semibold">{round(sd,3)}</div>
        </div>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={useSample}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseSample(e.target.checked)}
          />
          Use sample standard deviation (n−1)
        </label>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Option</th>
              <th className="p-2 text-left">Final</th>
              <th className="p-2 text-left">z</th>
              <th className="p-2 text-left">Φ(z)</th>
              <th className="p-2 text-left">1−Φ(z)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className="odd:bg-white even:bg-slate-50">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{round(r.v,3)}</td>
                <td className="p-2">{round(r.z,3)}</td>
                <td className="p-2">{round(r.cdf,4)}</td>
                <td className="p-2">{round(r.upper,4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length>0 && (
        <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm">
          <div className="font-semibold mb-1">Example interpretation</div>
          {(() => {
            const best = [...rows].sort((a,b)=>b.z - a.z)[0];
            return (
              <div>
                Highest standardized score: <span className="font-medium">{best.name}</span> with z = <span className="font-mono">{round(best.z,3)}</span> (Φ = {round(best.cdf,4)}).{" "}
                If z ≥ 2, it’s ~top 2.5% under normality; if 1 ≤ z &lt; 2, it’s above average but not an outlier.
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}