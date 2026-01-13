import { Job } from './Job';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { AppDataSource } from '../data-source';
import { TaskStatus } from '../workers/taskRunner';

interface TaskReport {
    taskId: string;
    type: string;
    status: string;
    output?: any;
    error?: string;
}

interface WorkflowReport {
    workflowId: string;
    tasks: TaskReport[];
    finalReport: string;
    generatedAt: string;
}

export class ReportGenerationJob implements Job {
    async run(task: Task): Promise<WorkflowReport> {
        console.log(`Generating report for workflow ${task.workflow.workflowId}...`);

        const taskRepository = AppDataSource.getRepository(Task);
        const resultRepository = AppDataSource.getRepository(Result);

        // Fetch all tasks for this workflow
        const workflowTasks = await taskRepository.find({
            where: { workflow: { workflowId: task.workflow.workflowId } },
            order: { stepNumber: 'ASC' }
        });

        const taskReports: TaskReport[] = [];

        for (const t of workflowTasks) {
            // Skip the current report task
            if (t.taskId === task.taskId) continue;

            const taskReport: TaskReport = {
                taskId: t.taskId,
                type: t.taskType,
                status: t.status
            };

            if (t.status === TaskStatus.Completed && t.resultId) {
                const result = await resultRepository.findOne({
                    where: { resultId: t.resultId }
                });
                if (result?.data) {
                    taskReport.output = JSON.parse(result.data);
                }
            } else if (t.status === TaskStatus.Failed) {
                taskReport.error = 'Task execution failed';
            }

            taskReports.push(taskReport);
        }

        const completedCount = taskReports.filter(
            t => t.status === TaskStatus.Completed
        ).length;
        const failedCount = taskReports.filter(
            t => t.status === TaskStatus.Failed
        ).length;

        const report: WorkflowReport = {
            workflowId: task.workflow.workflowId,
            tasks: taskReports,
            finalReport: `Workflow report: ${completedCount} tasks succeeded, ${failedCount} tasks failed`,
            generatedAt: new Date().toISOString()
        };

        console.log(`Report generated for workflow ${task.workflow.workflowId}`);

        return report;
    }
}
