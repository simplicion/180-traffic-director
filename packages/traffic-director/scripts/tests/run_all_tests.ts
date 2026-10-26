import { execSync } from 'child_process';
import path from 'path';

console.log('================================================================');
console.log('  180WORKSPACE TRAFFIC DIRECTOR: 16-SUITE AUTOMATED TEST RUNNER ');
console.log('================================================================\n');

const testFiles = [
  'test_1_signal_extraction.ts',
  'test_2_datacenter_asn_firewall.ts',
  'test_3_hardware_telemetry_probes.ts',
  'test_4_temporal_warmup_window.ts',
  'test_5_stealth_rampup_scaling.ts',
  'test_6_rule_condition_operators.ts',
  'test_7_rule_priority_matrix.ts',
  'test_8_client_shield_and_tag_generator.ts',
  'test_9_analytics_and_anomaly_sentinel.ts',
  'test_10_end_to_end_routing_simulator.ts',
  'test_11_self_hosted_tag_generation_and_edge_eval.ts',
  'test_12_stealth_ramp_up_and_cliff_prevention.ts',
  'test_13_deep_production_audit_5_pillars.ts',
  'test_14_custom_domain_centralized_manager.ts',
  'test_15_centralized_custom_domain_e2e_simulation.ts',
  'test_16_pincode_and_advanced_targeting_matrix.ts',
  'test_17_subpath_media_audio_and_link_cloaking.ts',
  'test_18_cloaking_superiority_matrix.ts',
  'test_19_threat_intelligence_and_tor_sync.ts',
  'test_20_simulator_advanced_signals.ts',
  'test_21_subscription_trial_and_locking.ts',
  'test_24_pixel_configuration_and_encryption.ts',
  'test_25_stealth_pixel_tag_generation.ts',
  'test_26_bot_gated_pixel_filtering.ts',
  'test_27_capi_event_deduplication.ts',
  'test_28_browser_client_event_simulation.ts',
  'test_29_dedicated_domain_e2e_pipeline.ts'
];

let totalPassed = 0;
let totalFailed = 0;
const results: { file: string; status: 'PASSED' | 'FAILED'; output?: string; error?: string }[] = [];

for (let i = 0; i < testFiles.length; i++) {
  const file = testFiles[i];
  const filePath = path.join(__dirname, file);
  console.log(`[Running Suite ${i + 1}/${testFiles.length}] ${file}...`);
  try {
    const output = execSync(`npx tsx "${filePath}"`, {
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '../../../../')
    });
    console.log(output);
    results.push({ file, status: 'PASSED', output });
    totalPassed++;
  } catch (err: any) {
    console.error(`❌ FAILED: ${file}`);
    console.error(err.stdout || err.message);
    results.push({ file, status: 'FAILED', error: err.stdout || err.message });
    totalFailed++;
  }
}

console.log('================================================================');
console.log('                      TEST EXECUTION SUMMARY                    ');
console.log('================================================================');
console.log(`Total Suites Run : ${testFiles.length}`);
console.log(`Suites Passed    : ${totalPassed} ✅`);
console.log(`Suites Failed    : ${totalFailed} ❌`);
console.log('================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
}
