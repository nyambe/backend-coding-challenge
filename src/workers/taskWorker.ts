import {AppDataSource} from '../data-source';
import {Task} from '../models/Task';
import {TaskRunner, TaskStatus} from './taskRunner';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        // Find queued tasks and check their dependencies
        const queuedTasks = await taskRepository.find({
            where: { status: TaskStatus.Queued },
            relations: ['workflow', 'dependency'],
            order: { stepNumber: 'ASC' }
        });

        // Find a task that's ready to run (no dependency or dependency completed)
        let taskToRun: Task | null = null;
        for (const task of queuedTasks) {
            if (!task.dependencyId) {
                // No dependency, can run immediately
                taskToRun = task;
                break;
            } else if (task.dependency && task.dependency.status === TaskStatus.Completed) {
                // Dependency is completed, can run
                taskToRun = task;
                break;
            }
            // If dependency exists but is not completed, skip this task for now
        }

        if (taskToRun) {
            try {
                await taskRunner.run(taskToRun);

            } catch (error) {
                console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                console.error(error);
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}