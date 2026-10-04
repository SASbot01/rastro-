import { test } from "node:test";
import assert from "node:assert/strict";
import { monitoringStreak } from "../lib/monitoring-streak.ts";
import { sharedMonitoring, csvCell } from "../lib/team-privacy.ts";
import { captureSummary, safeSource, reportCounts } from "../lib/report/presentation.ts";
import { computeScore, levelFor } from "../lib/report/score.ts";

test("a missing day, error or alert breaks a monitoring streak", () => {
  assert.equal(monitoringStreak([{day:"2026-09-16",status:"ok"},{day:"2026-09-14",status:"ok"}],"2026-09-16"),1);
  for (const status of ["error","alert"] as const) {
    assert.equal(monitoringStreak([{day:"2026-09-16",status:"ok"},{day:"2026-09-15",status},{day:"2026-09-14",status:"ok"}],"2026-09-16"),1);
  }
});
test("yesterday's streak remains until today's first check, but stale runs do not", () => {
  assert.equal(monitoringStreak([{day:"2026-09-15",status:"ok"},{day:"2026-09-14",status:"ok"}],"2026-09-16"),2);
  assert.equal(monitoringStreak([{day:"2026-09-14",status:"ok"}],"2026-09-16"),0);
  assert.equal(monitoringStreak([{day:"2026-09-17",status:"ok"}],"2026-09-16"),0);
});
test("streak crosses month boundaries and conflicting checks fail closed", () => {
  assert.equal(monitoringStreak([{day:"2026-03-01",status:"ok"},{day:"2026-02-28",status:"ok"}],"2026-03-01"),2);
  assert.equal(monitoringStreak([{day:"2026-09-16",status:"error"},{day:"2026-09-16",status:"ok"}],"2026-09-16"),0);
});
test("monitoring is never disclosed without consent, whether on or off", () => {
  for (const monitoring of [true,false]) assert.equal(sharedMonitoring({org_share_at:null,monitoring}),null);
  assert.equal(sharedMonitoring({org_share_at:"2026-09-16",monitoring:true}),true);
  assert.equal(sharedMonitoring({org_share_at:"2026-09-16",monitoring:false}),false);
});
test("CSV escapes quotes and neutralizes formula-like cells", () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  for (const value of ['=HYPERLINK("https://example.org")','+123','@SUM(1)','-2','  =2']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell("person@example.org"),'"person@example.org"');
});
test("capture payload excludes all personal free text and ignores info placeholders", () => {
  const findings = [
    {category:"profiles" as const,severity:"medium" as const,title:"PRIVATE NAME",detail:"PRIVATE ADDRESS",source_url:"https://private.example/person"},
    {category:"breaches" as const,severity:"info" as const,title:"Provider unavailable",detail:"Not checked",source_url:null},
  ];
  const output = captureSummary(72,findings);
  assert.equal(output.total,1); assert.equal(output.sources,1); assert.equal(output.categories.breaches,0);
  assert.doesNotMatch(JSON.stringify(output),/PRIVATE|private\.example|source_url/);
  assert.equal(reportCounts([...findings,findings[0]]).sources,1);
});
test("source URLs reject active schemes, credentials and invalid links", () => {
  for (const value of ["javascript:alert(1)","data:text/html,test","file:///etc/passwd","https://user:pass@example.com","/relative","invalid"]) assert.equal(safeSource(value),null);
  assert.equal(safeSource("https://example.org/page"),"https://example.org/page");
});
test("score remains deterministic and semaphores match rule boundaries", () => {
  assert.deepEqual([39,40,69,70].map(levelFor),["red","orange","orange","green"]);
  assert.equal(computeScore({breachesWithPassword:100,breachesWithoutPassword:100,publicProfiles:100,aiKnowsEmployer:true,aiKnowsCity:true,contactDataPublic:true,aiFalseData:true}).score,0);
});
