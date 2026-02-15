'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  BookOpen, FlaskConical, Bug, FolderOpen, Plus, Edit, Trash2, Star, 
  FileText, Upload, Search, ChevronRight, Bookmark, BookmarkCheck,
  TrendingUp, Clock, Hash, Database, Cloud, Download, RefreshCw,
  AlertCircle, CheckCircle2, Loader2, Folder, File, ChevronDown, ChevronUp,
  ArrowUpRight, Calendar, Layers, Target, Award, Eye, EyeOff, Menu, X,
  Home, Settings, BarChart3, BookMarked
} from 'lucide-react'

// Types
interface Subject {
  id: string
  name: string
  description: string | null
  color: string
  icon: string | null
  createdAt: string
  _count: { systems: number; questions: number }
  systems: { id: string; name: string }[]
  featuredQuestions: FeaturedQuestion[]
}

interface System {
  id: string
  name: string
  description: string | null
  order: number
  subjectId: string
  createdAt: string
  _count?: { marksSections: number; questions: number }
}

interface MarksSection {
  id: string
  marks: number
  label: string
  systemId: string
  _count?: { questions: number }
}

interface Question {
  id: string
  title: string
  description: string | null
  repeatCount: number
  years: string[]
  importanceScore: number
  globalImportance: number
  notes: string | null
  isBookmarked: boolean
  createdAt: string
  subject: { id: string; name: string; color: string }
  system: { id: string; name: string }
  marksSection: { id: string; marks: number; label: string }
  _count?: { files: number }
  files?: FileItem[]
  folders?: FolderItem[]
}

interface FeaturedQuestion {
  id: string
  title: string
  importanceScore: number
  repeatCount: number
  years: string
  subject?: { id: string; name: string; color: string }
  system?: { id: string; name: string }
  marksSection?: { id: string; marks: number; label: string }
}

interface FileItem {
  id: string
  name: string
  type: string
  url: string
  size: number
  description: string | null
  folderId: string | null
  createdAt: string
}

interface FolderItem {
  id: string
  name: string
  questionId: string
  _count?: { files: number }
}

interface Statistics {
  totalQuestions: number
  totalFiles: number
  totalSubjects: number
  totalSystems: number
  bookmarkedQuestions: number
  totalRepeatCount: number
  questionsWithFiles: number
  recentQuestions: number
  subjectBreakdown: Array<{
    id: string
    name: string
    color: string
    _count: { systems: number; questions: number }
  }>
  marksBreakdown: Array<{
    marks: number
    label: string
    count: number
  }>
}

export default function QuestionBankApp() {
  // State
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [featuredQuestions, setFeaturedQuestions] = useState<Question[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [selectedSystem, setSelectedSystem] = useState<System | null>(null)
  const [selectedMarksSection, setSelectedMarksSection] = useState<MarksSection | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [marksSections, setMarksSections] = useState<MarksSection[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [seeded, setSeeded] = useState(false)
  const [questionsSeeded, setQuestionsSeeded] = useState(false)
  const [seedingQuestions, setSeedingQuestions] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'dashboard' | 'subject' | 'system' | 'questions'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Modal states
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [showFileModal, setShowFileModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  
  // Form states
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', color: '#3b82f6' })
  const [questionForm, setQuestionForm] = useState({
    title: '',
    description: '',
    years: [] as string[],
    globalImportance: 0.5,
    notes: '',
    subjectId: '',
    systemId: '',
    marksSectionId: ''
  })
  const [newYear, setNewYear] = useState('')

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Check if seeded
      const seedRes = await fetch('/api/seed')
      const seedData = await seedRes.json()
      
      if (!seedData.data?.isSeeded) {
        // Seed the database
        await fetch('/api/seed', { method: 'POST' })
        setSeeded(true)
      }
      
      // Check if questions are seeded
      const questionsRes = await fetch('/api/seed-questions')
      const questionsData = await questionsRes.json()
      
      if (questionsData.data?.questionsCount === 0) {
        // Seed questions automatically
        setSeedingQuestions(true)
        const seedQuestionsRes = await fetch('/api/seed-questions', { method: 'POST' })
        const seedQuestionsData = await seedQuestionsRes.json()
        if (seedQuestionsData.success) {
          setQuestionsSeeded(true)
        }
        setSeedingQuestions(false)
      } else {
        setQuestionsSeeded(true)
      }
      
      // Fetch all data in parallel
      const [subjectsRes, statsRes, featuredRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/statistics'),
        fetch('/api/featured?limit=30')
      ])
      
      const [subjectsData, statsData, featuredData] = await Promise.all([
        subjectsRes.json(),
        statsRes.json(),
        featuredRes.json()
      ])
      
      if (subjectsData.success) setSubjects(subjectsData.data)
      if (statsData.success) setStatistics(statsData.data)
      if (featuredData.success) setFeaturedQuestions(featuredData.data)
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch systems when subject is selected
  const fetchSystems = async (subjectId: string) => {
    try {
      const res = await fetch(`/api/systems?subjectId=${subjectId}`)
      const data = await res.json()
      if (data.success) {
        setSystems(data.data)
      }
    } catch (error) {
      console.error('Error fetching systems:', error)
    }
  }

  // Fetch marks sections when system is selected
  const fetchMarksSections = async (systemId: string) => {
    try {
      const res = await fetch(`/api/marks-sections?systemId=${systemId}`)
      const data = await res.json()
      if (data.success) {
        setMarksSections(data.data)
      }
    } catch (error) {
      console.error('Error fetching marks sections:', error)
    }
  }

  // Fetch questions
  const fetchQuestions = async (filters: { subjectId?: string; systemId?: string; marksSectionId?: string; search?: string }) => {
    try {
      const params = new URLSearchParams()
      if (filters.subjectId) params.set('subjectId', filters.subjectId)
      if (filters.systemId) params.set('systemId', filters.systemId)
      if (filters.marksSectionId) params.set('marksSectionId', filters.marksSectionId)
      if (filters.search) params.set('search', filters.search)
      
      const res = await fetch(`/api/questions?${params}`)
      const data = await res.json()
      if (data.success) {
        setQuestions(data.data)
      }
    } catch (error) {
      console.error('Error fetching questions:', error)
    }
  }

  // Subject handlers
  const handleSaveSubject = async () => {
    try {
      const method = editingSubject ? 'PUT' : 'POST'
      const body = editingSubject 
        ? { ...subjectForm, id: editingSubject.id }
        : subjectForm
      
      const res = await fetch('/api/subjects', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      const data = await res.json()
      if (data.success) {
        setShowSubjectModal(false)
        setEditingSubject(null)
        setSubjectForm({ name: '', description: '', color: '#3b82f6' })
        fetchData()
      }
    } catch (error) {
      console.error('Error saving subject:', error)
    }
  }

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Are you sure? This will delete all associated data.')) return
    
    try {
      const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting subject:', error)
    }
  }

  // Question handlers
  const handleSaveQuestion = async () => {
    try {
      const method = editingQuestion ? 'PUT' : 'POST'
      const body = editingQuestion
        ? { ...questionForm, id: editingQuestion.id }
        : questionForm
      
      const res = await fetch('/api/questions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      const data = await res.json()
      if (data.success) {
        setShowQuestionModal(false)
        setEditingQuestion(null)
        setQuestionForm({
          title: '',
          description: '',
          years: [],
          globalImportance: 0.5,
          notes: '',
          subjectId: '',
          systemId: '',
          marksSectionId: ''
        })
        fetchData()
        if (selectedMarksSection) {
          fetchQuestions({ marksSectionId: selectedMarksSection.id })
        }
      }
    } catch (error) {
      console.error('Error saving question:', error)
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    
    try {
      const res = await fetch(`/api/questions?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchData()
        if (selectedMarksSection) {
          fetchQuestions({ marksSectionId: selectedMarksSection.id })
        }
      }
    } catch (error) {
      console.error('Error deleting question:', error)
    }
  }

  const toggleBookmark = async (question: Question) => {
    try {
      await fetch('/api/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: question.id,
          isBookmarked: !question.isBookmarked
        })
      })
      fetchData()
      if (selectedMarksSection) {
        fetchQuestions({ marksSectionId: selectedMarksSection.id })
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    }
  }

  // Navigation handlers
  const navigateToSubject = (subject: Subject) => {
    setSelectedSubject(subject)
    setSelectedSystem(null)
    setSelectedMarksSection(null)
    setViewMode('subject')
    fetchSystems(subject.id)
  }

  const navigateToSystem = (system: System) => {
    setSelectedSystem(system)
    setSelectedMarksSection(null)
    setViewMode('system')
    fetchMarksSections(system.id)
  }

  const navigateToMarksSection = (marksSection: MarksSection) => {
    setSelectedMarksSection(marksSection)
    setViewMode('questions')
    fetchQuestions({ marksSectionId: marksSection.id })
  }

  const goBack = () => {
    if (viewMode === 'questions') {
      setSelectedMarksSection(null)
      setViewMode('system')
    } else if (viewMode === 'system') {
      setSelectedSystem(null)
      setViewMode('subject')
    } else if (viewMode === 'subject') {
      setSelectedSubject(null)
      setViewMode('dashboard')
    }
  }

  // Add year to question form
  const addYear = () => {
    if (newYear && !questionForm.years.includes(newYear)) {
      setQuestionForm(prev => ({
        ...prev,
        years: [...prev.years, newYear]
      }))
      setNewYear('')
    }
  }

  const removeYear = (year: string) => {
    setQuestionForm(prev => ({
      ...prev,
      years: prev.years.filter(y => y !== year)
    }))
  }

  // Get subject icon
  const getSubjectIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'pathology': return <FlaskConical className="h-5 w-5" />
      case 'pharmacology': return <FolderOpen className="h-5 w-5" />
      case 'microbiology': return <Bug className="h-5 w-5" />
      default: return <BookOpen className="h-5 w-5" />
    }
  }

  // Export data
  const exportData = async () => {
    try {
      const res = await fetch('/api/backup')
      const response = await res.json()
      if (response.success) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `question-bank-backup-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        
        // Show success message with counts
        alert(`Backup created successfully!\n\nSubjects: ${response.data.counts?.subjects || 0}\nSystems: ${response.data.counts?.systems || 0}\nQuestions: ${response.data.counts?.questions || 0}\nFiles: ${response.data.counts?.files || 0}`)
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Error creating backup. Please try again.')
    }
  }

  // Loading state
  if (loading || seedingQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">
            {seedingQuestions ? 'Seeding Medical Questions...' : 'Loading Question Bank...'}
          </p>
          {seedingQuestions && (
            <p className="text-slate-500 text-sm mt-2">Adding Pathology, Pharmacology, and Microbiology questions</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900/80 border-r border-slate-700 flex flex-col transition-all duration-300 sticky top-0 h-screen`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-white">QBank</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white p-1"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Content */}
        <ScrollArea className="flex-1 py-4">
          {/* Home */}
          <div className="px-3 mb-4">
            <button
              onClick={() => {
                setViewMode('dashboard')
                setSelectedSubject(null)
                setSelectedSystem(null)
                setSelectedMarksSection(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'dashboard' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Home className="h-5 w-5" />
              {sidebarOpen && <span className="text-sm font-medium">Dashboard</span>}
            </button>
          </div>

          {/* Statistics */}
          {sidebarOpen && (
            <div className="px-4 mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Overview</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-white">{statistics?.totalQuestions || 0}</p>
                  <p className="text-xs text-slate-400">Questions</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-white">{statistics?.totalSubjects || 0}</p>
                  <p className="text-xs text-slate-400">Subjects</p>
                </div>
              </div>
            </div>
          )}

          <Separator className="my-4 bg-slate-700" />

          {/* Subjects Navigation */}
          <div className="px-3">
            {sidebarOpen && (
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Subjects</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingSubject(null)
                    setSubjectForm({ name: '', description: '', color: '#3b82f6' })
                    setShowSubjectModal(true)
                  }}
                  className="h-5 w-5 p-0 text-slate-400 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}

            {subjects.map((subject) => (
              <div key={subject.id} className="mb-1">
                <button
                  onClick={() => navigateToSubject(subject)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    selectedSubject?.id === subject.id 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: subject.color }}
                  />
                  {sidebarOpen && (
                    <>
                      <span className="text-sm flex-1 text-left truncate">{subject.name}</span>
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                        {subject._count.questions}
                      </Badge>
                    </>
                  )}
                </button>
                
                {/* Systems under subject */}
                {sidebarOpen && selectedSubject?.id === subject.id && viewMode !== 'dashboard' && (
                  <div className="ml-4 mt-1 space-y-1">
                    {systems.sort((a, b) => a.order - b.order).map((system) => (
                      <button
                        key={system.id}
                        onClick={() => navigateToSystem(system)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedSystem?.id === system.id
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <Layers className="h-3 w-3" />
                        <span className="truncate">{system.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Separator className="my-4 bg-slate-700" />

          {/* Quick Actions */}
          <div className="px-3 space-y-1">
            {sidebarOpen && (
              <p className="text-xs text-slate-500 uppercase tracking-wider px-1 mb-2">Quick Actions</p>
            )}
            <button
              onClick={exportData}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Cloud className="h-5 w-5" />
              {sidebarOpen && <span className="text-sm">Backup Data</span>}
            </button>
            <button
              onClick={fetchData}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
              {sidebarOpen && <span className="text-sm">Refresh</span>}
            </button>
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-700">
          {sidebarOpen && (
            <p className="text-xs text-slate-500 text-center">
              Question Bank v1.0
            </p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      {viewMode === 'dashboard' && 'Dashboard'}
                      {viewMode === 'subject' && selectedSubject?.name}
                      {viewMode === 'system' && selectedSystem?.name}
                      {viewMode === 'questions' && selectedMarksSection?.label}
                    </h1>
                    <p className="text-xs text-slate-400">
                      {viewMode === 'dashboard' && 'Welcome to Question Bank'}
                      {viewMode === 'subject' && selectedSubject?.description}
                      {viewMode === 'system' && selectedSystem?.description}
                      {viewMode === 'questions' && `${selectedSystem?.name} - ${selectedSubject?.name}`}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (e.target.value.length > 2) {
                        fetchQuestions({ search: e.target.value })
                      }
                    }}
                    className="w-64 pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                
                {viewMode !== 'dashboard' && (
                  <Button variant="outline" size="sm" onClick={goBack} className="border-slate-700 text-slate-300">
                    <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                    Back
                  </Button>
                )}
              </div>
            </div>
            
            {/* Breadcrumb */}
            {viewMode !== 'dashboard' && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <span 
                  className="text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => setViewMode('dashboard')}
                >
                  Dashboard
                </span>
                {selectedSubject && (
                  <>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                    <span 
                      className="text-slate-300 cursor-pointer hover:text-white"
                      onClick={() => setViewMode('subject')}
                    >
                      {selectedSubject.name}
                    </span>
                  </>
                )}
                {selectedSystem && (
                  <>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                    <span 
                      className="text-slate-300 cursor-pointer hover:text-white"
                      onClick={() => setViewMode('system')}
                    >
                      {selectedSystem.name}
                    </span>
                  </>
                )}
                {selectedMarksSection && (
                  <>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                    <span className="text-white font-medium">
                      {selectedMarksSection.label}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6">
        {/* Dashboard View */}
        {viewMode === 'dashboard' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-lg">
                      <BookOpen className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{statistics?.totalSubjects || 0}</p>
                      <p className="text-xs text-slate-400">Subjects</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/20 p-2 rounded-lg">
                      <Layers className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{statistics?.totalSystems || 0}</p>
                      <p className="text-xs text-slate-400">Systems</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-500/20 p-2 rounded-lg">
                      <FileText className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{statistics?.totalQuestions || 0}</p>
                      <p className="text-xs text-slate-400">Questions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-500/20 p-2 rounded-lg">
                      <Folder className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{statistics?.totalFiles || 0}</p>
                      <p className="text-xs text-slate-400">Files</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-500/20 p-2 rounded-lg">
                      <Bookmark className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{statistics?.bookmarkedQuestions || 0}</p>
                      <p className="text-xs text-slate-400">Bookmarked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-500/20 p-2 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{statistics?.totalRepeatCount || 0}</p>
                      <p className="text-xs text-slate-400">Total Repeats</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subjects Section */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-400" />
                Subjects
              </h2>
              <Dialog open={showSubjectModal} onOpenChange={setShowSubjectModal}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setEditingSubject(null)
                      setSubjectForm({ name: '', description: '', color: '#3b82f6' })
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700 text-white">
                  <DialogHeader>
                    <DialogTitle>{editingSubject ? 'Edit' : 'Add New'} Subject</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      {editingSubject ? 'Update subject details' : 'Create a new subject category'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label className="text-slate-300">Name *</Label>
                      <Input
                        value={subjectForm.name}
                        onChange={(e) => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Pathology"
                        className="bg-slate-700 border-slate-600 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Description</Label>
                      <Textarea
                        value={subjectForm.description}
                        onChange={(e) => setSubjectForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description..."
                        className="bg-slate-700 border-slate-600 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="color"
                          value={subjectForm.color}
                          onChange={(e) => setSubjectForm(prev => ({ ...prev, color: e.target.value }))}
                          className="w-12 h-10 p-1 bg-slate-700 border-slate-600"
                        />
                        <Input
                          value={subjectForm.color}
                          onChange={(e) => setSubjectForm(prev => ({ ...prev, color: e.target.value }))}
                          className="bg-slate-700 border-slate-600 flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setShowSubjectModal(false)} className="border-slate-600 text-slate-300">
                      Cancel
                    </Button>
                    <Button onClick={handleSaveSubject} className="bg-blue-600 hover:bg-blue-700">
                      {editingSubject ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              {subjects.map((subject) => (
                <Card 
                  key={subject.id}
                  className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all cursor-pointer group"
                  onClick={() => navigateToSubject(subject)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${subject.color}20` }}
                        >
                          <span style={{ color: subject.color }}>{getSubjectIcon(subject.name)}</span>
                        </div>
                        <div>
                          <CardTitle className="text-white text-lg">{subject.name}</CardTitle>
                          <CardDescription className="text-slate-400 text-xs">
                            {subject.description || 'No description'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSubject(subject)
                            setSubjectForm({
                              name: subject.name,
                              description: subject.description || '',
                              color: subject.color
                            })
                            setShowSubjectModal(true)
                          }}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSubject(subject.id)
                          }}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Layers className="h-4 w-4" />
                        <span>{subject._count.systems} Systems</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <FileText className="h-4 w-4" />
                        <span>{subject._count.questions} Questions</span>
                      </div>
                    </div>
                    {subject.featuredQuestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 mb-2">Featured Questions:</p>
                        <div className="space-y-1">
                          {subject.featuredQuestions.slice(0, 3).map((q) => (
                            <div key={q.id} className="text-xs text-slate-400 flex items-center gap-2">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span className="truncate">{q.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Featured Questions Section */}
            {featuredQuestions.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <Award className="h-5 w-5 text-yellow-400" />
                  Top 30 Featured Questions
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ml-2">
                    By Importance Score
                  </Badge>
                </h2>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      {featuredQuestions.map((q, index) => (
                        <div 
                          key={q.id}
                          className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index < 3 ? 'bg-yellow-500 text-slate-900' : 'bg-slate-600 text-slate-300'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-white font-medium">{q.title}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                {q.subject && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ borderColor: q.subject.color, color: q.subject.color }}
                                  >
                                    {q.subject.name}
                                  </Badge>
                                )}
                                {q.system && (
                                  <span className="flex items-center gap-1">
                                    <Layers className="h-3 w-3" />
                                    {q.system.name}
                                  </span>
                                )}
                                {q.marksSection && (
                                  <span className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    {q.marksSection.marks} marks
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-400">{(q.importanceScore * 100).toFixed(0)}%</p>
                              <p className="text-xs text-slate-500">Score</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-blue-400">{q.repeatCount}</p>
                              <p className="text-xs text-slate-500">Repeats</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Marks Distribution */}
            {statistics?.marksBreakdown && statistics.marksBreakdown.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5 text-purple-400" />
                  Marks Distribution
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {(() => {
                    // Aggregate counts by marks value
                    const aggregated = statistics.marksBreakdown.reduce((acc, curr) => {
                      const existing = acc.find(m => m.marks === curr.marks);
                      if (existing) {
                        existing.count += curr.count;
                      } else {
                        acc.push({ marks: curr.marks, label: curr.label, count: curr.count });
                      }
                      return acc;
                    }, [] as Array<{ marks: number; label: string; count: number }>);
                    
                    return aggregated.sort((a, b) => b.marks - a.marks).map((mark, index) => (
                      <Card key={`marks-${mark.marks}-${index}`} className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-white">{mark.marks}</p>
                          <p className="text-xs text-slate-400 mb-2">Marks</p>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                            {mark.count} Qs
                          </Badge>
                        </CardContent>
                      </Card>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subject View - Systems List */}
        {viewMode === 'subject' && selectedSubject && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${selectedSubject.color}20` }}
                  >
                    <span style={{ color: selectedSubject.color }}>{getSubjectIcon(selectedSubject.name)}</span>
                  </div>
                  {selectedSubject.name}
                </h2>
                <p className="text-slate-400 mt-1">{selectedSubject.description}</p>
              </div>
            </div>

            {/* Featured Questions for Subject */}
            {selectedSubject.featuredQuestions.length > 0 && (
              <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-400" />
                    Featured Questions - Top 30
                  </CardTitle>
                  <CardDescription>Most important questions based on repeat count and recency</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {selectedSubject.featuredQuestions.map((q, index) => (
                      <div key={q.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index < 5 ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{q.title}</p>
                          <p className="text-xs text-slate-400">
                            Score: {(q.importanceScore * 100).toFixed(0)}% | Repeats: {q.repeatCount}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Systems Grid */}
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-green-400" />
              Systems
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systems.sort((a, b) => a.order - b.order).map((system) => (
                <Card 
                  key={system.id}
                  className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all cursor-pointer group"
                  onClick={() => navigateToSystem(system)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          <span className="text-slate-500 text-sm">#{system.order}</span>
                          {system.name}
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs mt-1">
                          {system.description || 'No description'}
                        </CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-white transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        <span>Mark Sections</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* System View - Marks Sections */}
        {viewMode === 'system' && selectedSystem && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedSystem.name}</h2>
                <p className="text-slate-400">{selectedSystem.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {marksSections.sort((a, b) => b.marks - a.marks).map((section) => (
                <Card 
                  key={section.id}
                  className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                  onClick={() => navigateToMarksSection(section)}
                >
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-white mb-1">{section.marks}</div>
                    <div className="text-xs text-slate-400 mb-3">{section.label}</div>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 group-hover:bg-purple-500/30 transition-colors">
                      View Questions
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Questions View */}
        {viewMode === 'questions' && selectedMarksSection && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Target className="h-6 w-6 text-purple-400" />
                  {selectedMarksSection.label}
                </h2>
                <p className="text-slate-400">
                  {selectedSystem?.name} - {selectedSubject?.name}
                </p>
              </div>
              <Dialog open={showQuestionModal} onOpenChange={setShowQuestionModal}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      setEditingQuestion(null)
                      setQuestionForm({
                        title: '',
                        description: '',
                        years: [],
                        globalImportance: 0.5,
                        notes: '',
                        subjectId: selectedSubject?.id || '',
                        systemId: selectedSystem?.id || '',
                        marksSectionId: selectedMarksSection?.id || ''
                      })
                    }}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingQuestion ? 'Edit' : 'Add New'} Question</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      {selectedMarksSection.label} - {selectedSystem?.name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label className="text-slate-300">Topic/Title *</Label>
                      <Input
                        value={questionForm.title}
                        onChange={(e) => setQuestionForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Inflammation - Definition and Types"
                        className="bg-slate-700 border-slate-600 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Full Question Description</Label>
                      <Textarea
                        value={questionForm.description}
                        onChange={(e) => setQuestionForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Write the complete question text here..."
                        className="bg-slate-700 border-slate-600 mt-1 min-h-[100px]"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Years Asked (Repeat Tracking)</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={newYear}
                          onChange={(e) => setNewYear(e.target.value)}
                          placeholder="e.g., 2023"
                          className="bg-slate-700 border-slate-600 flex-1"
                        />
                        <Button type="button" onClick={addYear} variant="outline" className="border-slate-600">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {questionForm.years.sort((a, b) => parseInt(b) - parseInt(a)).map((year) => (
                          <Badge 
                            key={year} 
                            className="bg-blue-500/20 text-blue-300 border-blue-500/30 cursor-pointer hover:bg-red-500/20 hover:text-red-300"
                            onClick={() => removeYear(year)}
                          >
                            {year} <X className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Click on a year badge to remove it</p>
                    </div>
                    <div>
                      <Label className="text-slate-300">Global Importance Factor: {questionForm.globalImportance.toFixed(1)}</Label>
                      <Input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={questionForm.globalImportance}
                        onChange={(e) => setQuestionForm(prev => ({ ...prev, globalImportance: parseFloat(e.target.value) }))}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Low</span>
                        <span>Medium</span>
                        <span>High</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300">Notes</Label>
                      <Textarea
                        value={questionForm.notes}
                        onChange={(e) => setQuestionForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional notes, mnemonics, or references..."
                        className="bg-slate-700 border-slate-600 mt-1"
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setShowQuestionModal(false)} className="border-slate-600 text-slate-300">
                      Cancel
                    </Button>
                    <Button onClick={handleSaveQuestion} className="bg-purple-600 hover:bg-purple-700">
                      {editingQuestion ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {questions.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No questions yet</p>
                    <p className="text-slate-500 text-sm">Click "Add Question" to get started</p>
                  </CardContent>
                </Card>
              ) : (
                questions.map((question) => (
                  <Card key={question.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-white font-semibold">{question.title}</h3>
                            {question.isBookmarked && (
                              <BookmarkCheck className="h-4 w-4 text-yellow-400" />
                            )}
                          </div>
                          {question.description && (
                            <p className="text-slate-400 text-sm mb-2">{question.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs">
                            {question.years.length > 0 && (
                              <div className="flex items-center gap-1 text-blue-400">
                                <Calendar className="h-3 w-3" />
                                <span>{question.years.sort((a, b) => parseInt(b) - parseInt(a)).join(', ')}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-green-400">
                              <TrendingUp className="h-3 w-3" />
                              <span>Score: {(question.importanceScore * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-purple-400">
                              <Hash className="h-3 w-3" />
                              <span>{question.repeatCount} repeats</span>
                            </div>
                            {question._count && question._count.files > 0 && (
                              <div className="flex items-center gap-1 text-orange-400">
                                <Folder className="h-3 w-3" />
                                <span>{question._count.files} files</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleBookmark(question)}
                            className={question.isBookmarked ? "text-yellow-400" : "text-slate-400"}
                          >
                            {question.isBookmarked ? (
                              <BookmarkCheck className="h-4 w-4" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingQuestion(question)
                              setQuestionForm({
                                title: question.title,
                                description: question.description || '',
                                years: question.years,
                                globalImportance: question.globalImportance,
                                notes: question.notes || '',
                                subjectId: question.subject.id,
                                systemId: question.system.id,
                                marksSectionId: question.marksSection.id
                              })
                              setShowQuestionModal(true)
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Importance Score Bar */}
                      <div className="mt-3">
                        <Progress 
                          value={question.importanceScore * 100} 
                          className="h-1.5 bg-slate-700"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  )
}
