import { createRouter, createWebHistory } from 'vue-router'
// import HomeView from '../views/HomeView.vue'
import stock from '../components/stock.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Qms3D.vue')
      //component: HomeView,
    },
    {
      path: '/qms',
      name: 'qms-3d',
      component: () => import('../views/Qms3D.vue')
    },
    {
      path: '/heatmap',
      name: 'heatmap-3d',
      component: () => import('../views/Heatmap3D.vue')
    },
    {
      path: '/heatmap2d',
      name: 'heatmap-2d',
      component: () => import('../views/Heatmap2D.vue')
    },
    {
      path: '/dosing-rules',
      redirect: '/rules'
    },
    {
      path: '/rules',
      name: 'rules-management',
      component: () => import('../views/RulesManagement.vue')
    },
    {
      path: '/dosing',
      name: 'dosing',
      component: () => import('../views/DosingDashboard.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    },
    {
      path: '/lab',
      name: 'lab',
      component: () => import('../views/LabDashboard.vue')
    },
    {
      path: '/stock',
      name: 'stock',
      component: stock
    },
    {
      path: '/mobile-entry',
      name: 'mobile-entry',
      component: () => import('../views/MobileEntry.vue')
    },
    {
      path: '/process-quality',
      name: 'process-quality',
      component: () => import('../views/ProcessQualityDashboard.vue')
    },
    {
      path: '/trace',
      name: 'traceability',
      component: () => import('../views/TraceabilityDashboard.vue')
    },
    {
      path: '/standards',
      name: 'standards',
      component: () => import('../views/StandardsManagement.vue')
    },
    {
      path: '/six-sigma',
      name: 'six-sigma',
      component: () => import('../views/SixSigma.vue')
    },
  ],
})

export default router
