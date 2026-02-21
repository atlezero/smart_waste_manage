import { NextRequest, NextResponse } from 'next/server';

// Alternative OSRM servers
const OSRM_SERVERS = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
  'https://routing.openstreetmap.de/routed-foot',
];

// GET - Get route between two points
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startLon = searchParams.get('startLon');
  const startLat = searchParams.get('startLat');
  const endLon = searchParams.get('endLon');
  const endLat = searchParams.get('endLat');

  console.log('Route API called with:', { startLon, startLat, endLon, endLat });

  if (!startLon || !startLat || !endLon || !endLat) {
    return NextResponse.json(
      { success: false, error: 'Start and end coordinates are required' },
      { status: 400 }
    );
  }

  // Validate coordinates are numbers
  const startLonNum = parseFloat(startLon);
  const startLatNum = parseFloat(startLat);
  const endLonNum = parseFloat(endLon);
  const endLatNum = parseFloat(endLat);

  if (isNaN(startLonNum) || isNaN(startLatNum) || isNaN(endLonNum) || isNaN(endLatNum)) {
    return NextResponse.json(
      { success: false, error: 'Invalid coordinates' },
      { status: 400 }
    );
  }

  // Validate coordinate ranges
  if (startLatNum < -90 || startLatNum > 90 || endLatNum < -90 || endLatNum > 90) {
    return NextResponse.json(
      { success: false, error: 'Invalid latitude range' },
      { status: 400 }
    );
  }

  if (startLonNum < -180 || startLonNum > 180 || endLonNum < -180 || endLonNum > 180) {
    return NextResponse.json(
      { success: false, error: 'Invalid longitude range' },
      { status: 400 }
    );
  }

  // Try multiple OSRM servers
  for (const server of OSRM_SERVERS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const osrmUrl = `${server}/route/v1/driving/${startLonNum},${startLatNum};${endLonNum},${endLatNum}?overview=full&geometries=geojson&steps=true&alternatives=false`;
      console.log(`Trying OSRM server: ${server}`);

      const response = await fetch(osrmUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MunicipalWasteManagement/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log(`${server} response:`, data.code);
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          console.log(`Success with ${server}`);
          return NextResponse.json({
            success: true,
            data,
          });
        }
      }
    } catch (error) {
      console.log(`${server} failed:`, error instanceof Error ? error.message : 'Unknown error');
      continue;
    }
  }

  // If all OSRM servers fail, try GraphHopper (free tier without API key has limits)
  try {
    const graphHopperUrl = `https://graphhopper.com/api/1/route?point=${startLatNum},${startLonNum}&point=${endLatNum},${endLonNum}&vehicle=car&locale=th&calc_points=true&points_encoded=false&key=`;
    
    console.log('Trying GraphHopper');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(graphHopperUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MunicipalWasteManagement/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      if (data.paths && data.paths.length > 0) {
        const path = data.paths[0];
        
        // Convert GraphHopper format to OSRM format
        const osrmData = {
          code: 'Ok',
          routes: [{
            distance: path.distance,
            duration: path.time / 1000, // GraphHopper returns milliseconds
            geometry: path.points,
            legs: [{
              steps: path.instructions?.map((inst: { distance: number; time: number; text: string; sign: number }) => ({
                distance: inst.distance,
                duration: inst.time / 1000,
                name: inst.text || '',
                maneuver: {
                  type: getManeuverType(inst.sign),
                },
              })) || [],
            }],
          }],
        };

        console.log('GraphHopper success');
        return NextResponse.json({
          success: true,
          data: osrmData,
        });
      }
    }
  } catch (error) {
    console.log('GraphHopper failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  return NextResponse.json(
    { success: false, error: 'ไม่สามารถคำนวณเส้นทางได้ กรุณาลองใหม่อีกครั้ง' },
    { status: 500 }
  );
}

function getManeuverType(sign: number): string {
  switch (sign) {
    case 0: return 'continue';
    case 1: return 'turn'; // turn right
    case -1: return 'turn'; // turn left
    case 2: return 'turn'; // sharp right
    case -2: return 'turn'; // sharp left
    case 3: return 'turn'; // slight right
    case -3: return 'turn'; // slight left
    case 4: return 'arrive';
    case 5: return 'depart';
    case 6: return 'roundabout';
    default: return 'continue';
  }
}
