import { Job } from './Job';
import { Task } from '../models/Task';
import { area } from '@turf/turf';
import { Feature, Polygon } from 'geojson';

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<{ area: number; unit: string }> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        try {
            const geoJsonFeature: Feature<Polygon> = JSON.parse(task.geoJson);
            const calculatedArea = area(geoJsonFeature);

            console.log(`Polygon area calculated: ${calculatedArea} square meters`);

            return {
                area: calculatedArea,
                unit: 'square meters'
            };
        } catch (error) {
            console.error(`Invalid GeoJSON for task ${task.taskId}:`, error);
            throw new Error('Invalid GeoJSON provided for polygon area calculation');
        }
    }
}
