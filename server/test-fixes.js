require("dotenv").config();
const llmService = require("./services/llmService");

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";

function calculateDistance(coord1, coord2) {
  const R = 6371;
  const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const dLng = ((coord2[1] - coord1[1]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[0] * Math.PI) / 180) *
      Math.cos((coord2[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateTotalRouteDistance(coordinates) {
  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalDistance += calculateDistance(coordinates[i], coordinates[i + 1]);
  }
  return totalDistance;
}

async function testSingleRoute(location, country = null) {
  const testLocation = country ? `${location}, ${country}` : location;
  
  console.log(`\n${BLUE}Testing fixes for: ${testLocation}${RESET}`);
  console.log("=".repeat(50));
  
  try {
    const startTime = Date.now();
    const route = await llmService.generateRoute(
      country || location,
      "trekking", 
      country ? location : null
    );
    const duration = Date.now() - startTime;
    
    const routeData = route.routeData;
    const coordinates = routeData.coordinates;
    const llmDistance = routeData.totalDistance;
    const calculatedDistance = calculateTotalRouteDistance(coordinates);
    
    // Check circularity
    const startCoord = coordinates[0];
    const endCoord = coordinates[coordinates.length - 1];
    const startEndDistance = calculateDistance(startCoord, endCoord);
    const isCircular = startEndDistance < 0.1; // 100m tolerance
    
    // Results
    console.log(`\n${GREEN}RESULTS:${RESET}`);
    console.log(`  Generation time: ${duration}ms`);
    console.log(`  Routing method: ${route.routingMetadata?.method || 'unknown'}`);
    console.log(`  Coordinates generated: ${coordinates.length}`);
    
    console.log(`\n${BLUE}DISTANCE ANALYSIS:${RESET}`);
    console.log(`  LLM Distance: ${llmDistance}km`);
    console.log(`  Calculated Distance: ${calculatedDistance.toFixed(2)}km`);
    const discrepancy = Math.abs(llmDistance - calculatedDistance);
    const discrepancyPercent = (discrepancy / llmDistance) * 100;
    console.log(`  Discrepancy: ${discrepancyPercent.toFixed(1)}%`);
    
    console.log(`\n${BLUE}CIRCULARITY CHECK:${RESET}`);
    console.log(`  Start point: [${startCoord[0].toFixed(6)}, ${startCoord[1].toFixed(6)}]`);
    console.log(`  End point: [${endCoord[0].toFixed(6)}, ${endCoord[1].toFixed(6)}]`);
    console.log(`  Distance apart: ${(startEndDistance * 1000).toFixed(0)}m`);
    console.log(`  Is circular: ${isCircular ? 'YES' : 'NO'}`);
    
    console.log(`\n${BLUE}CONSTRAINTS CHECK:${RESET}`);
    const distanceOk = llmDistance >= 5 && llmDistance <= 15;
    console.log(`  Distance within 5-15km: ${distanceOk ? 'YES' : 'NO'} (${llmDistance}km)`);
    
    // Overall status
    const status = isCircular && distanceOk && discrepancyPercent < 50 ? 'PASS' : 'FAIL';
    const statusColor = status === 'PASS' ? GREEN : RED;
    console.log(`\n${statusColor}OVERALL STATUS: ${status}${RESET}`);
    
    if (route.routingMetadata?.error) {
      console.log(`\n${YELLOW}Routing Errors: ${route.routingMetadata.error}${RESET}`);
    }
    
    return {
      status,
      llmDistance,
      calculatedDistance,
      discrepancyPercent,
      isCircular,
      startEndDistance,
      routingMethod: route.routingMetadata?.method,
      coordinatesCount: coordinates.length
    };
    
  } catch (error) {
    console.error(`${RED}❌ Failed: ${error.message}${RESET}`);
    return { status: 'ERROR', error: error.message };
  }
}

async function runTest() {
  console.log(`${BLUE}=== TESTING TREKKING ROUTE FIXES ===${RESET}`);
  
  // Test a few locations to verify fixes
  const results = [];
  
  // Test 1: Switzerland (previously had 778% discrepancy)
  results.push(await testSingleRoute('Switzerland'));
  await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay
  
  // Test 2: A specific city 
  results.push(await testSingleRoute('Interlaken', 'Switzerland'));
  await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay
  
  // Test 3: Different country
  results.push(await testSingleRoute('Norway'));
  
  // Summary
  console.log(`\n${BLUE}=== SUMMARY ===${RESET}`);
  console.log("=".repeat(50));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length; 
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`${GREEN}Passed: ${passed}${RESET}`);
  console.log(`${RED}Failed: ${failed}${RESET}`);
  console.log(`${RED}Errors: ${errors}${RESET}`);
  
  console.log(`\n${BLUE}Fix Effectiveness:${RESET}`);
  const validResults = results.filter(r => r.status !== 'ERROR');
  
  if (validResults.length > 0) {
    const avgDiscrepancy = validResults.reduce((sum, r) => sum + (r.discrepancyPercent || 0), 0) / validResults.length;
    const circularCount = validResults.filter(r => r.isCircular).length;
    
    console.log(`  Average distance discrepancy: ${avgDiscrepancy.toFixed(1)}%`);
    console.log(`  Circular routes: ${circularCount}/${validResults.length}`);
    
    // Check improvement
    if (avgDiscrepancy < 100) {
      console.log(`  ${GREEN}✓ Major improvement in distance accuracy!${RESET}`);
    }
    if (circularCount === validResults.length) {
      console.log(`  ${GREEN}✓ All routes are properly circular!${RESET}`);
    }
  }
}

runTest().catch(error => {
  console.error(`${RED}Test failed: ${error.message}${RESET}`);
  process.exit(1);
});