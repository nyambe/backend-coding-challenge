import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import {TaskStatus} from "../workers/taskRunner";

export enum WorkflowStatus {
    Initial = 'initial',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

interface WorkflowStep {
    taskType: string;
    stepNumber: number;
    name?: string;
    dependsOn?: string;
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class WorkflowFactory {
    constructor(private dataSource: DataSource) {}

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     * @param filePath - Path to the YAML file.
     * @param clientId - Client identifier for the workflow.
     * @param geoJson - The geoJson data string for tasks (customize as needed).
     * @returns A promise that resolves to the created Workflow.
     */
    async createWorkflowFromYAML(filePath: string, clientId: string, geoJson: string): Promise<Workflow> {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const workflowDef = yaml.load(fileContent) as WorkflowDefinition;
        const workflowRepository = this.dataSource.getRepository(Workflow);
        const taskRepository = this.dataSource.getRepository(Task);
        const workflow = new Workflow();

        workflow.clientId = clientId;
        workflow.status = WorkflowStatus.Initial;

        const savedWorkflow = await workflowRepository.save(workflow);

        // First pass: create all tasks and store by name
        const tasksByName: Map<string, Task> = new Map();
        const tasks: Task[] = workflowDef.steps.map(step => {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.name = step.name;
            task.workflow = savedWorkflow;

            if (step.name) {
                tasksByName.set(step.name, task);
            }
            return task;
        });

        // Save all tasks first to get IDs
        await taskRepository.save(tasks);

        // Second pass: link dependencies
        for (const step of workflowDef.steps) {
            if (step.dependsOn && step.name) {
                const task = tasksByName.get(step.name);
                const dependencyTask = tasksByName.get(step.dependsOn);
                if (task && dependencyTask) {
                    task.dependencyId = dependencyTask.taskId;
                    await taskRepository.save(task);
                }
            }
        }

        return savedWorkflow;
    }
}