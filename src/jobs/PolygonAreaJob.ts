import { Job } from './Job';
import { Task } from '../models/Task';
import area from '@turf/area';
import { Feature, Polygon, MultiPolygon } from 'geojson';

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<{ area: number; unit: string }> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        try {
            const geoJson = JSON.parse(task.geoJson);

            // Handle both raw geometry and Feature objects
            let feature: Feature<Polygon | MultiPolygon>;
            if (geoJson.type === 'Feature') {
                feature = geoJson;
            } else if (geoJson.type === 'Polygon' || geoJson.type === 'MultiPolygon') {
                feature = {
                    type: 'Feature',
                    properties: {},
                    geometry: geoJson
                };
            } else {
                throw new Error(`Invalid GeoJSON type: ${geoJson.type}. Expected Polygon or MultiPolygon.`);
            }

            // Calculate area in square meters
            const areaInSquareMeters = area(feature);

            console.log(`Polygon area: ${areaInSquareMeters} square meters`);

            return {
                area: areaInSquareMeters,
                unit: 'square meters'
            };
        } catch (error: any) {
            console.error(`Error calculating polygon area: ${error.message}`);
            throw new Error(`Failed to calculate polygon area: ${error.message}`);
        }
    }
}
