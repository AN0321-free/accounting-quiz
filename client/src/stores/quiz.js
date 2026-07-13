import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useQuizStore = defineStore('quiz', () => {
  const questionBank = ref([])
  const shuffledOrder = ref([])
  const currentIndex = ref(0)
  const correctAnswers = ref({})
  const wrongAnswers = ref({})
  const userAnswers = ref({})
  const answeredQuestions = ref({})
  const currentCategory = ref('全部')
  const wrongMode = ref(false)
  const questionCategories = ref({})

  const totalCount = computed(() => shuffledOrder.value.length)
  const correctCount = computed(() => {
    let c = 0
    for (let i = 0; i < shuffledOrder.value.length; i++) {
      if (correctAnswers.value[shuffledOrder.value[i]]) c++
    }
    return c
  })
  const wrongCount = computed(() => {
    let w = 0
    for (let i = 0; i < shuffledOrder.value.length; i++) {
      if (wrongAnswers.value[shuffledOrder.value[i]]) w++
    }
    return w
  })
  const accuracy = computed(() => {
    const answered = correctCount.value + wrongCount.value
    return answered > 0 ? Math.round((correctCount.value / answered) * 100) : 0
  })
  const progressPct = computed(() => {
    let answered = 0
    for (let i = 0; i < shuffledOrder.value.length; i++) {
      if (answeredQuestions.value[shuffledOrder.value[i]]) answered++
    }
    return shuffledOrder.value.length > 0 ? (answered / shuffledOrder.value.length) * 100 : 0
  })
  const currentQuestion = computed(() => {
    if (shuffledOrder.value.length === 0) return null
    return questionBank.value[shuffledOrder.value[currentIndex.value]]
  })

  function extractCategory(q) {
    const match = q.match(/^【(.+?)】/)
    if (!match) return '会计基础'
    const tag = match[1]
    const mainTag = tag.split('·')[0]
    const known = ['金融资产', '非流动负债', '流动负债', '货币资金', '固定资产', '投资性房地产', '存货', '费用', '长投', '利润', '权益', '收入', '无形资产']
    return known.includes(mainTag) ? mainTag : '会计基础'
  }

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function getFilteredIndices() {
    const indices = []
    for (let i = 0; i < questionBank.value.length; i++) {
      if (currentCategory.value === '全部' || questionCategories.value[i] === currentCategory.value) {
        indices.push(i)
      }
    }
    return indices
  }

  function applyShuffle() {
    shuffledOrder.value = shuffle(getFilteredIndices())
    currentIndex.value = 0
    saveProgress()
  }

  function setCategory(cat) {
    currentCategory.value = cat
    wrongMode.value = false
    applyShuffle()
  }

  function toggleWrongMode() {
    if (!wrongMode.value) {
      const wrongs = []
      for (let i = 0; i < shuffledOrder.value.length; i++) {
        if (wrongAnswers.value[shuffledOrder.value[i]]) wrongs.push(shuffledOrder.value[i])
      }
      if (wrongs.length === 0) return false
      shuffledOrder.value = wrongs
      currentIndex.value = 0
      wrongMode.value = true
    } else {
      wrongMode.value = false
      applyShuffle()
    }
    return true
  }

  async function submitAnswer(userAnswer) {
    const bankIndex = shuffledOrder.value[currentIndex.value]
    const correct = questionBank.value[bankIndex].a
    const cleanUser = userAnswer.trim().toUpperCase()
    const cleanCorrect = correct.trim().toUpperCase()

    let isCorrect = false
    if (cleanCorrect.length > 1) {
      isCorrect = cleanUser.split('').sort().join('') === cleanCorrect.split('').sort().join('')
    } else {
      isCorrect = cleanUser === cleanCorrect
    }

    answeredQuestions.value[bankIndex] = true
    userAnswers.value[bankIndex] = userAnswer

    if (isCorrect) {
      correctAnswers.value[bankIndex] = true
      delete wrongAnswers.value[bankIndex]
    } else {
      wrongAnswers.value[bankIndex] = true
      delete correctAnswers.value[bankIndex]
    }

    saveProgress()

    // Deduct quota for free users
    try {
      await api.post('/questions/use')
    } catch (e) { /* quota exhausted handled in component */ }

    return { isCorrect, correctAnswer: correct }
  }

  function goToPrev() {
    if (currentIndex.value > 0) {
      currentIndex.value--
      saveProgress()
    }
  }

  function goToNext() {
    if (currentIndex.value < shuffledOrder.value.length - 1) {
      currentIndex.value++
      saveProgress()
    }
  }

  function saveProgress() {
    const data = {
      correctAnswers: correctAnswers.value,
      wrongAnswers: wrongAnswers.value,
      userAnswers: userAnswers.value,
      answeredQuestions: answeredQuestions.value,
      currentCategory: currentCategory.value
    }
    localStorage.setItem('quiz_progress', JSON.stringify(data))
    // Also sync to server
    api.post('/progress', data).catch(() => {})
  }

  async function loadProgress() {
    // Try local first
    const local = localStorage.getItem('quiz_progress')
    if (local) {
      const data = JSON.parse(local)
      correctAnswers.value = data.correctAnswers || {}
      wrongAnswers.value = data.wrongAnswers || {}
      userAnswers.value = data.userAnswers || {}
      answeredQuestions.value = data.answeredQuestions || {}
      currentCategory.value = data.currentCategory || '全部'
    }
    // Try server
    try {
      const { data } = await api.get('/progress')
      if (data) {
        correctAnswers.value = { ...data.correctAnswers }
        wrongAnswers.value = { ...data.wrongAnswers }
        userAnswers.value = { ...data.userAnswers }
        answeredQuestions.value = { ...data.answeredQuestions }
        currentCategory.value = data.currentCategory || '全部'
      }
    } catch (e) { /* use local */ }
    applyShuffle()
  }

  function resetProgress() {
    correctAnswers.value = {}
    wrongAnswers.value = {}
    userAnswers.value = {}
    answeredQuestions.value = {}
    currentCategory.value = '全部'
    wrongMode.value = false
    localStorage.removeItem('quiz_progress')
    applyShuffle()
  }

  function initQuestions(questions) {
    questionBank.value = questions
    for (let i = 0; i < questions.length; i++) {
      questionCategories.value[i] = extractCategory(questions[i].q)
    }
    applyShuffle()
  }

  return {
    questionBank, shuffledOrder, currentIndex, correctAnswers, wrongAnswers,
    userAnswers, answeredQuestions, currentCategory, wrongMode, questionCategories,
    totalCount, correctCount, wrongCount, accuracy, progressPct, currentQuestion,
    setCategory, toggleWrongMode, submitAnswer, goToPrev, goToNext,
    saveProgress, loadProgress, resetProgress, initQuestions
  }
})