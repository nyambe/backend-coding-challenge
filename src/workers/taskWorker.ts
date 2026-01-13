import {AppDataSource} from '../data-source';
import {Task} from '../models/Task';
import {TaskRunner, TaskStatus} from './taskRunner';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        // Find queued tasks where dependency is null OR dependency is completed
        const task = await taskRepository
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.workflow', 'workflow')
            .leftJoinAndSelect('task.dependency', 'dependency')
            .where('task.status = :status', { status: TaskStatus.Queued })
            .andWhere(
                '(task.dependencyId IS NULL OR dependency.status = :completedStatus)',
                { completedStatus: TaskStatus.Completed }
            )
            .orderBy('task.stepNumber', 'ASC')
            .getOne();

        if (task) {
            try {
                await taskRunner.run(task);

            } catch (error) {
                console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                console.error(error);
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}