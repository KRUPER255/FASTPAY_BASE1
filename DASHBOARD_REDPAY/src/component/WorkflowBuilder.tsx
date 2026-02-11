import { useState, useEffect, useCallback } from 'react'
import { ref, set, get, onValue, off } from 'firebase/database'
import { database } from '@/lib/firebase'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/component/ui/card'
import { Badge } from '@/component/ui/badge'
import {
  Plus,
  Trash2,
  Save,
  Play,
  ChevronUp,
  ChevronDown,
  Copy,
  Loader,
  ChevronRight,
  Code,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/component/ui/dialog'

interface WorkflowStep {
  step: number
  command: string
  content: string
  delay: number
  onSuccess: 'continue' | 'stop' | 'jump'
  onFailure: 'continue' | 'stop' | 'jump'
  jumpToStep?: number
}

interface Workflow {
  workflowId: string
  steps: WorkflowStep[]
}

interface WorkflowBuilderProps {
  deviceId: string | null
  onExecute?: (workflowJson: string) => void
  allCommands: Record<string, any>
}

export default function WorkflowBuilder({ deviceId, onExecute, allCommands }: WorkflowBuilderProps) {
  const { toast } = useToast()
  const [workflowId, setWorkflowId] = useState('')
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [savedWorkflows, setSavedWorkflows] = useState<Record<string, Workflow>>({})
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showJsonPreview, setShowJsonPreview] = useState(false)

  // Load saved workflows from Firebase
  useEffect(() => {
    if (!deviceId) return

    const workflowsRef = ref(database, `fastpay/${deviceId}/workflowTemplates`)
    const unsubscribe = onValue(
      workflowsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setSavedWorkflows(snapshot.val())
        } else {
          setSavedWorkflows({})
        }
      },
      (error) => {
        console.error('Error loading workflows:', error)
      }
    )

    return () => {
      off(workflowsRef, 'value', unsubscribe)
    }
  }, [deviceId])

  const addStep = useCallback(() => {
    const newStep: WorkflowStep = {
      step: steps.length + 1,
      command: '',
      content: '',
      delay: 0,
      onSuccess: 'continue',
      onFailure: 'stop',
    }
    setSteps([...steps, newStep])
  }, [steps])

  const removeStep = useCallback((index: number) => {
    const newSteps = steps.filter((_, i) => i !== index)
    // Renumber steps
    const renumbered = newSteps.map((step, i) => ({ ...step, step: i + 1 }))
    setSteps(renumbered)
  }, [steps])

  const updateStep = useCallback((index: number, field: keyof WorkflowStep, value: any) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setSteps(newSteps)
  }, [steps])

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    
    // Renumber steps
    const renumbered = newSteps.map((step, i) => ({ ...step, step: i + 1 }))
    setSteps(renumbered)
  }, [steps])

  const duplicateStep = useCallback((index: number) => {
    const stepToDuplicate = steps[index]
    const newStep: WorkflowStep = {
      ...stepToDuplicate,
      step: steps.length + 1,
    }
    setSteps([...steps, newStep])
  }, [steps])

  const getCommandConfig = useCallback((commandKey: string) => {
    return allCommands[commandKey] || null
  }, [allCommands])

  const formatCommandContent = useCallback((commandKey: string, params: Record<string, any>) => {
    const config = getCommandConfig(commandKey)
    if (!config || !config.formatCommand) return ''
    return config.formatCommand(params)
  }, [getCommandConfig])

  const validateWorkflow = useCallback((): { valid: boolean; error?: string } => {
    if (!workflowId.trim()) {
      return { valid: false, error: 'Workflow ID is required' }
    }

    if (steps.length === 0) {
      return { valid: false, error: 'Workflow must have at least one step' }
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step.command) {
        return { valid: false, error: `Step ${step.step}: Command is required` }
      }
      if (step.onSuccess === 'jump' && !step.jumpToStep) {
        return { valid: false, error: `Step ${step.step}: Jump step number required when onSuccess is "jump"` }
      }
      if (step.onFailure === 'jump' && !step.jumpToStep) {
        return { valid: false, error: `Step ${step.step}: Jump step number required when onFailure is "jump"` }
      }
    }

    return { valid: true }
  }, [workflowId, steps])

  const generateWorkflowJson = useCallback((): string => {
    const workflow: Workflow = {
      workflowId: workflowId.trim() || `workflow_${Date.now()}`,
      steps: steps.map(step => ({
        step: step.step,
        command: step.command,
        content: step.content,
        delay: step.delay,
        onSuccess: step.onSuccess,
        onFailure: step.onFailure,
        ...(step.jumpToStep ? { jumpToStep: step.jumpToStep } : {}),
      })),
    }
    return JSON.stringify(workflow, null, 2)
  }, [workflowId, steps])

  const saveWorkflow = useCallback(async () => {
    const validation = validateWorkflow()
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      })
      return
    }

    if (!deviceId) {
      toast({
        title: 'Error',
        description: 'Device ID is required',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const workflow: Workflow = {
        workflowId: workflowId.trim(),
        steps,
      }

      const workflowsRef = ref(database, `fastpay/${deviceId}/workflowTemplates/${workflowId.trim()}`)
      await set(workflowsRef, workflow)

      toast({
        title: 'Workflow Saved',
        description: `Workflow "${workflowId}" saved successfully`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Error saving workflow:', error)
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save workflow',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [workflowId, steps, deviceId, validateWorkflow, toast])

  const loadWorkflow = useCallback((workflowId: string) => {
    const workflow = savedWorkflows[workflowId]
    if (workflow) {
      setWorkflowId(workflow.workflowId)
      setSteps(workflow.steps)
      setShowLoadDialog(false)
      toast({
        title: 'Workflow Loaded',
        description: `Workflow "${workflowId}" loaded successfully`,
        variant: 'success',
      })
    }
  }, [savedWorkflows, toast])

  const deleteWorkflow = useCallback(async (workflowId: string) => {
    if (!deviceId) return

    try {
      const workflowsRef = ref(database, `fastpay/${deviceId}/workflowTemplates/${workflowId}`)
      await set(workflowsRef, null)
      toast({
        title: 'Workflow Deleted',
        description: `Workflow "${workflowId}" deleted`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Error deleting workflow:', error)
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete workflow',
        variant: 'destructive',
      })
    }
  }, [deviceId, toast])

  const executeWorkflow = useCallback(() => {
    const validation = validateWorkflow()
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      })
      return
    }

    const workflowJson = generateWorkflowJson()
    if (onExecute) {
      onExecute(workflowJson)
    }
  }, [validateWorkflow, generateWorkflowJson, onExecute])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflow Builder</CardTitle>
              <CardDescription>Create and execute command workflows</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLoadDialog(true)}
              >
                Load Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveWorkflow}
                disabled={loading || !workflowId.trim() || steps.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button
                size="sm"
                onClick={executeWorkflow}
                disabled={!workflowId.trim() || steps.length === 0}
              >
                <Play className="h-4 w-4 mr-2" />
                Execute
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Workflow ID */}
          <div>
            <Label>Workflow ID</Label>
            <Input
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="upload_file_workflow"
            />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Workflow Steps {steps.length > 0 && <Badge variant="secondary" className="ml-2">{steps.length}</Badge>}</Label>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>

            {steps.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border rounded-lg">
                No steps added. Click "Add Step" to start building your workflow.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {steps.map((step, index) => {
                const config = getCommandConfig(step.command)
                return (
                  <Card key={index} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Step {step.step}</Badge>
                          {config && (
                            <span className="text-sm font-medium">{config.label}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === steps.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateStep(index)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStep(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Command Selection */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Command *</Label>
                          <Select
                            value={step.command}
                            onValueChange={(value) => updateStep(index, 'command', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select command..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(allCommands).map(([key, cmd]) => (
                                <SelectItem key={key} value={key}>
                                  {cmd.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Delay (ms)</Label>
                          <Input
                            type="number"
                            value={step.delay}
                            onChange={(e) => updateStep(index, 'delay', parseInt(e.target.value) || 0)}
                            min={0}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Command Content */}
                      {step.command && (
                        <div>
                          <Label>Command Content</Label>
                          <Input
                            value={step.content}
                            onChange={(e) => updateStep(index, 'content', e.target.value)}
                            placeholder={config?.format || 'Enter command parameters...'}
                          />
                          {config && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Format: {config.format}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Conditional Actions */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>On Success</Label>
                          <Select
                            value={step.onSuccess}
                            onValueChange={(value: 'continue' | 'stop' | 'jump') => {
                              updateStep(index, 'onSuccess', value)
                              if (value !== 'jump') {
                                updateStep(index, 'jumpToStep', undefined)
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="continue">Continue</SelectItem>
                              <SelectItem value="stop">Stop</SelectItem>
                              <SelectItem value="jump">Jump to Step</SelectItem>
                            </SelectContent>
                          </Select>
                          {step.onSuccess === 'jump' && (
                            <Input
                              type="number"
                              value={step.jumpToStep || ''}
                              onChange={(e) => updateStep(index, 'jumpToStep', parseInt(e.target.value) || undefined)}
                              placeholder="Step number"
                              className="mt-2"
                              min={1}
                              max={steps.length}
                            />
                          )}
                        </div>

                        <div>
                          <Label>On Failure</Label>
                          <Select
                            value={step.onFailure}
                            onValueChange={(value: 'continue' | 'stop' | 'jump') => {
                              updateStep(index, 'onFailure', value)
                              if (value !== 'jump') {
                                updateStep(index, 'jumpToStep', undefined)
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="continue">Continue</SelectItem>
                              <SelectItem value="stop">Stop</SelectItem>
                              <SelectItem value="jump">Jump to Step</SelectItem>
                            </SelectContent>
                          </Select>
                          {step.onFailure === 'jump' && (
                            <Input
                              type="number"
                              value={step.jumpToStep || ''}
                              onChange={(e) => updateStep(index, 'jumpToStep', parseInt(e.target.value) || undefined)}
                              placeholder="Step number"
                              className="mt-2"
                              min={1}
                              max={steps.length}
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              </div>
            )}
          </div>

          {/* JSON Preview */}
          {steps.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJsonPreview(!showJsonPreview)}
                className="w-full justify-between"
              >
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <Label className="cursor-pointer">Workflow JSON Preview</Label>
                </div>
                {showJsonPreview ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              {showJsonPreview && (
                <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-64 border">
                  {generateWorkflowJson()}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load Workflow Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Workflow Template</DialogTitle>
            <DialogDescription>Select a saved workflow to load</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.keys(savedWorkflows).length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No saved workflows found
              </div>
            ) : (
              Object.entries(savedWorkflows).map(([id, workflow]) => (
                <Card key={id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{workflow.workflowId}</div>
                        <div className="text-sm text-muted-foreground">
                          {workflow.steps.length} step(s)
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadWorkflow(id)}
                        >
                          Load
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteWorkflow(id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
