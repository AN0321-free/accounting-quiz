<template>
  <div>
    <div class="card filter-bar">
      <span class="filter-label">📂 章节筛选：</span>
      <select v-model="selectedCategory" @change="changeCategory">
        <option value="全部">全部章节</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <button class="btn btn-sm" :class="quiz.wrongMode ? 'btn-danger' : 'btn-outline'" @click="toggleWrongMode">
        {{ quiz.wrongMode ? '📋 错题模式（退出）' : '📋 错题回顾 (' + wrongCountAll + '题)' }}
      </button>
      <button class="btn btn-outline btn-sm" style="border-color:rgba(231,76,60,0.4);color:#e74c3c" @click="resetProgress">🔄 重置进度</button>
    </div>

    <div class="card">
      <div class="stats-bar">
        <div class="stat-item"><div class="stat-value">{{ quiz.totalCount }}</div><div class="stat-label">总题数</div></div>
        <div class="stat-item"><div class="stat-value">{{ quiz.correctCount }}</div><div class="stat-label">正确</div></div>
        <div class="stat-item"><div class="stat-value">{{ quiz.wrongCount }}</div><div class="stat-label">错误</div></div>
        <div class="stat-item"><div class="stat-value">{{ quiz.accuracy }}%</div><div class="stat-label">正确率</div></div>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" :style="{ width: quiz.progressPct + '%' }"></div>
      </div>

      <div v-if="quiz.currentQuestion" class="question-area">
        <div class="question-number">第 {{ quiz.currentIndex + 1 }} / {{ quiz.totalCount }} 题</div>
        <div class="question-text" v-html="formatQuestion(quiz.currentQuestion.q)"></div>

        <div v-if="!auth.isPremium && auth.user?.membership === 'free'" class="quota-info">
          今日剩余：{{ auth.user?.dailyQuestionsLeft }} 题
          <router-link to="/pricing" class="upgrade-link">升级会员无限刷题</router-link>
        </div>

        <input type="text" class="answer-input" v-model="userAnswer" :placeholder="placeholder"
          :disabled="isAnswered" :class="answerClass" @keydown.enter="handleEnter" ref="answerInputRef" />

        <div class="feedback" v-if="feedbackMsg" :class="feedbackClass">{{ feedbackMsg }}</div>
        <div class="correct-answer-display" v-if="showCorrectAnswer">📝 正确答案：{{ correctAnswer }}</div>
        <div class="explanation" v-if="quiz.currentQuestion.e">📖 解析：{{ quiz.currentQuestion.e }}</div>

        <div class="nav-buttons">
          <button class="btn btn-outline" :disabled="quiz.currentIndex === 0" @click="quiz.goToPrev()">⬅ 上一题</button>
          <button class="btn" :class="isAnswered ? 'btn-success' : 'btn-primary'" :disabled="isAnswered" @click="handleSubmit">
            {{ isAnswered ? '已作答' : '✓ 提交答案' }}
          </button>
          <button class="btn btn-outline" :disabled="quiz.currentIndex >= quiz.totalCount - 1" @click="quiz.goToNext()">下一题 ➡</button>
        </div>
      </div>

      <div v-else class="empty-state">
        <div class="icon">{{ quiz.wrongMode ? '🎉' : '📭' }}</div>
        <p>{{ quiz.wrongMode ? '太棒了！暂无错题，继续加油！' : '没有题目，请切换章节' }}</p>
      </div>
    </div>

    <div class="toast" :class="'toast ' + toastType" v-if="toastMsg" v-text="toastMsg"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useQuizStore } from '../stores/quiz'
import { useAuthStore } from '../stores/auth'
import { questions } from '../data/questions'

const quiz = useQuizStore()
const auth = useAuthStore()
const userAnswer = ref('')
const isAnswered = ref(false)
const feedbackMsg = ref('')
const feedbackClass = ref('')
const showCorrectAnswer = ref(false)
const correctAnswer = ref('')
const answerClass = ref('')
const toastMsg = ref('')
const toastType = ref('info')
const answerInputRef = ref(null)
const selectedCategory = ref('全部')

const categories = ['会计基础', '金融资产', '流动负债', '非流动负债', '货币资金', '固定资产', '投资性房地产', '存货', '费用', '长投', '利润', '权益', '收入', '无形资产']

const wrongCountAll = computed(() => Object.keys(quiz.wrongAnswers).length)

const placeholder = computed(() => {
  if (!quiz.currentQuestion) return ''
  const a = quiz.currentQuestion.a
  if (a.length > 1) return '输入答案字母，顺序不限，如 ABC'
  if (a === '对' || a === '错') return '请输入 对 或 错'
  return '输入答案字母，如 A'
})

function showToast(msg, type) {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => { toastMsg.value = '' }, 2500)
}

function formatQuestion(q) {
  return q.replace(/\n/g, '<br>')
}

function changeCategory() {
  quiz.setCategory(selectedCategory.value)
  resetState()
  showToast('已筛选：' + (selectedCategory.value === '全部' ? '全部章节' : selectedCategory.value), 'info')
}

function toggleWrongMode() {
  const result = quiz.toggleWrongMode()
  resetState()
  if (result) {
    showToast(quiz.wrongMode ? '进入错题回顾模式' : '已退出错题模式', 'info')
  } else {
    showToast('暂无错题，继续加油！', 'info')
  }
}

function resetProgress() {
  if (confirm('确定要重置所有刷题进度吗？此操作不可恢复！')) {
    quiz.resetProgress()
    selectedCategory.value = '全部'
    resetState()
    showToast('进度已重置', 'info')
  }
}

function resetState() {
  userAnswer.value = ''
  isAnswered.value = false
  feedbackMsg.value = ''
  feedbackClass.value = ''
  showCorrectAnswer.value = false
  correctAnswer.value = ''
  answerClass.value = ''
}

async function handleSubmit() {
  const answer = userAnswer.value.trim()
  if (!answer) {
    showToast('请输入你的答案', 'info')
    return
  }

  const result = await quiz.submitAnswer(answer)
  isAnswered.value = true

  if (result.isCorrect) {
    answerClass.value = 'answer-input correct'
    feedbackMsg.value = '✅ 回答正确！'
    feedbackClass.value = 'feedback correct show'
    showCorrectAnswer.value = false
    showToast('回答正确！', 'success')
    if (!quiz.wrongMode) {
      setTimeout(() => {
        if (quiz.currentIndex < quiz.totalCount - 1) {
          quiz.goToNext()
          resetState()
          nextTick(() => answerInputRef.value?.focus())
        }
      }, 1500)
    }
  } else {
    answerClass.value = 'answer-input wrong'
    feedbackMsg.value = '❌ 回答错误'
    feedbackClass.value = 'feedback wrong show'
    showCorrectAnswer.value = true
    correctAnswer.value = result.correctAnswer
    showToast('回答错误', 'error')
  }

  await auth.fetchUser()
}

function handleEnter() {
  if (!isAnswered.value) {
    handleSubmit()
  } else if (quiz.currentIndex < quiz.totalCount - 1) {
    quiz.goToNext()
    resetState()
    nextTick(() => answerInputRef.value?.focus())
  }
}

watch(() => quiz.currentQuestion, () => {
  resetState()
  nextTick(() => answerInputRef.value?.focus())
})

onMounted(() => {
  quiz.initQuestions(questions)
  selectedCategory.value = quiz.currentCategory
  nextTick(() => answerInputRef.value?.focus())
})
</script>

<style scoped>
.card {
  background: #fff;
}
.filter-bar {
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
}
.filter-label { font-size: 0.85em; color: #888; white-space: nowrap; }
.filter-bar select { padding: 10px 14px; border-radius: 10px; border: 1px solid #e0dcd0; background: #fafaf7; color: #333; font-size: 0.9em; outline: none; cursor: pointer; font-family: inherit; min-width: 130px; }
.filter-bar select:focus { border-color: #a18cd1; }
.filter-bar select option { background: #fff; color: #333; }
.filter-bar select:disabled { opacity: 0.4; cursor: not-allowed; }
.stats-bar { display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px; }
.stat-item { flex: 1; min-width: 80px; background: #fafaf7; border-radius: 12px; padding: 15px; text-align: center; border: 1px solid #e8e2d5; }
.stat-value { font-size: 1.8em; font-weight: 700; background: linear-gradient(90deg, #a18cd1, #fbc2eb); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.stat-label { font-size: 0.8em; color: #888; margin-top: 4px; }
.progress-bar-wrap { background: #e8e2d5; border-radius: 10px; height: 8px; margin-bottom: 25px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #a18cd1, #fbc2eb); border-radius: 10px; transition: width 0.4s ease; }
.question-number { font-size: 0.85em; color: #6c5ce7; margin-bottom: 10px; }
.question-text { font-size: 1.3em; font-weight: 600; line-height: 1.8; margin-bottom: 25px; color: #333; padding: 20px; background: #fafaf7; border-radius: 12px; border-left: 4px solid #a18cd1; white-space: pre-wrap; word-break: break-word; }
.quota-info { text-align: center; padding: 10px; margin-bottom: 15px; background: rgba(241,196,15,0.08); border-radius: 10px; color: #b8860b; font-size: 0.9em; }
.upgrade-link { color: #6c5ce7; margin-left: 8px; font-weight: 600; }
.answer-input { width: 100%; padding: 14px 18px; border-radius: 12px; border: 1px solid #e0dcd0; background: #fafaf7; color: #333; font-size: 1em; outline: none; transition: all 0.3s ease; font-family: inherit; }
.answer-input::placeholder { color: #aaa; }
.answer-input:focus { border-color: #a18cd1; box-shadow: 0 0 0 3px rgba(161,140,209,0.15); }
.answer-input.correct { border-color: #2ecc71; background: rgba(46,204,113,0.05); }
.answer-input.wrong { border-color: #e74c3c; background: rgba(231,76,60,0.05); }
.feedback { margin-top: 15px; padding: 14px 18px; border-radius: 12px; font-weight: 600; display: none; animation: fadeIn 0.3s ease; }
.feedback.show { display: block; }
.feedback.correct { background: rgba(46,204,113,0.08); color: #27ae60; border: 1px solid rgba(46,204,113,0.2); }
.feedback.wrong { background: rgba(231,76,60,0.08); color: #c0392b; border: 1px solid rgba(231,76,60,0.2); }
.correct-answer-display { margin-top: 10px; padding: 12px 16px; background: rgba(46,204,113,0.06); border-radius: 10px; border: 1px solid rgba(46,204,113,0.15); color: #27ae60; font-weight: 500; }
.explanation { margin-top: 10px; padding: 14px 18px; background: rgba(161,140,209,0.05); border-radius: 10px; border: 1px solid rgba(161,140,209,0.2); color: #5a4a8a; font-size: 0.9em; line-height: 1.7; }
.nav-buttons { display: flex; gap: 12px; margin-top: 25px; justify-content: center; }
.nav-buttons .btn { flex: 1; }
.empty-state { text-align: center; padding: 60px 20px; color: #888; }
.empty-state .icon { font-size: 4em; margin-bottom: 15px; }
.empty-state p { font-size: 1.1em; color: #666; }
@media (max-width: 600px) {
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-bar select { width: 100%; }
  .nav-buttons { flex-direction: column; }
  .stats-bar { flex-direction: column; }
  .question-text { font-size: 1.1em; }
}
</style>