import { PolygonAreaJob } from '../jobs/PolygonAreaJob';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

describe('PolygonAreaJob', () => {
    let job: PolygonAreaJob;

    beforeEach(() => {
        job = new PolygonAreaJob();
    });

    it('should calculate the area of a valid polygon', async () => {
        const task = createMockTask({
            type: 'Polygon',
            coordinates: [
                [
                    [-63.624885020050996, -10.311050368263523],
                    [-63.624885020050996, -10.367865108370523],
                    [-63.61278302732815, -10.367865108370523],
                    [-63.61278302732815, -10.311050368263523],
                    [-63.624885020050996, -10.311050368263523]
                ]
            ]
        });

        const result = await job.run(task);

        expect(result).toHaveProperty('area');
        expect(result).toHaveProperty('unit', 'square meters');
        expect(result.area).toBeGreaterThan(0);
        // The area should be approximately 8.3 million square meters
        expect(result.area).toBeCloseTo(8363324, -4);
    });

    it('should handle a Feature object with Polygon geometry', async () => {
        const task = createMockTask({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [0, 0],
                        [0, 1],
                        [1, 1],
                        [1, 0],
                        [0, 0]
                    ]
                ]
            }
        });

        const result = await job.run(task);

        expect(result).toHaveProperty('area');
        expect(result).toHaveProperty('unit', 'square meters');
        expect(result.area).toBeGreaterThan(0);
    });

    it('should throw an error for invalid GeoJSON type', async () => {
        const task = createMockTask({
            type: 'Point',
            coordinates: [0, 0]
        });

        await expect(job.run(task)).rejects.toThrow('Invalid GeoJSON type');
    });

    it('should throw an error for malformed JSON', async () => {
        const task = {
            taskId: 'test-task-id',
            geoJson: 'not valid json',
        } as Task;

        await expect(job.run(task)).rejects.toThrow();
    });
});

function createMockTask(geoJson: object): Task {
    const task = new Task();
    task.taskId = 'test-task-id';
    task.clientId = 'test-client';
    task.geoJson = JSON.stringify(geoJson);
    task.status = TaskStatus.Queued;
    task.taskType = 'polygonArea';
    task.stepNumber = 1;
    return task;
}
