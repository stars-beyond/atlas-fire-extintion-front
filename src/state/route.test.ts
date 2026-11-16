// A tela na URL: hash → tela/passo (readRoute) e tela/passo → hash (routeHash).
import { describe, expect, it } from 'vitest'
import { STEPS } from './materials'
import { readRoute, routeHash } from './route'
import type { View } from './types'

const VIEWS: View[] = ['home', 'drive', 'dashboard', 'historia', 'achados', 'investigacoes', 'proximo', 'perguntar']

describe('readRoute', () => {
  it('sem hash é a home', () => {
    expect(readRoute('')).toEqual({ view: 'home' })
    expect(readRoute('#')).toEqual({ view: 'home' })
    expect(readRoute('#/')).toEqual({ view: 'home' })
  })
  it.each<[string, View]>([
    ['#lab', 'drive'], ['#dashboard', 'dashboard'], ['#story', 'historia'], ['#findings', 'achados'],
    ['#investigations', 'investigacoes'], ['#next-fire', 'proximo'], ['#ask', 'perguntar'],
  ])('%s abre a tela %s, sem passo', (hash, view) => {
    expect(readRoute(hash)).toEqual({ view })
  })
  it('aceita o hash sem "#", com "#/" e em maiúsculas', () => {
    expect(readRoute('dashboard')).toEqual({ view: 'dashboard' })
    expect(readRoute('#/dashboard')).toEqual({ view: 'dashboard' })
    expect(readRoute('#Dashboard')).toEqual({ view: 'dashboard' })
    expect(readRoute('#LAB/Material')).toEqual({ view: 'drive', step: 1 })
  })
  it.each([['#lab/habitat', 0], ['#lab/material', 1], ['#lab/test-drive', 2], ['#lab/spec-sheet', 3]])('%s abre o laboratório no passo %i', (hash, step) => {
    expect(readRoute(hash)).toEqual({ view: 'drive', step })
  })
  it('passo desconhecido ou vazio: abre o laboratório sem dizer o passo', () => {
    expect(readRoute('#lab/nada')).toEqual({ view: 'drive' })
    expect(readRoute('#lab/')).toEqual({ view: 'drive' })
    expect(readRoute('#lab/2')).toEqual({ view: 'drive' })
  })
  it('o passo só vale no laboratório', () => {
    expect(readRoute('#dashboard/material')).toEqual({ view: 'dashboard' })
    expect(readRoute('#ask/habitat')).toEqual({ view: 'perguntar' })
  })
  it('ignora o que vem depois do passo', () => {
    expect(readRoute('#lab/material/extra')).toEqual({ view: 'drive', step: 1 })
  })
  it('devolve null para um hash que não é de nenhuma tela', () => {
    for (const hash of ['#cite-3', '#nada', '#lab2', '#dash', '#home', '#drive', '#achados', '#dashboard?x=1', '#__proto__', '#constructor'])
      expect(readRoute(hash)).toBeNull()
  })
})

describe('routeHash', () => {
  it('a home não tem hash', () => {
    expect(routeHash('home', 0)).toBe('')
    expect(routeHash('home', 2)).toBe('')
  })
  it('as telas fora do laboratório não levam o passo', () => {
    expect(routeHash('dashboard', 2)).toBe('#dashboard')
    expect(routeHash('historia', 0)).toBe('#story')
    expect(routeHash('achados', 1)).toBe('#findings')
    expect(routeHash('investigacoes', 3)).toBe('#investigations')
    expect(routeHash('proximo', 0)).toBe('#next-fire')
    expect(routeHash('perguntar', 0)).toBe('#ask')
  })
  it('o laboratório leva o passo', () => {
    expect(routeHash('drive', 0)).toBe('#lab/habitat')
    expect(routeHash('drive', 1)).toBe('#lab/material')
    expect(routeHash('drive', 2)).toBe('#lab/test-drive')
    expect(routeHash('drive', 3)).toBe('#lab/spec-sheet')
  })
  it('passo fora da lista: só o laboratório', () => {
    expect(routeHash('drive', 4)).toBe('#lab')
    expect(routeHash('drive', -1)).toBe('#lab')
    expect(routeHash('drive', NaN)).toBe('#lab')
  })
})

describe('ida e volta', () => {
  it('cada tela volta do próprio hash', () => {
    for (const view of VIEWS) expect(readRoute(routeHash(view, 0))?.view).toBe(view)
  })
  it('cada passo do laboratório (STEPS) tem hash e volta dele', () => {
    STEPS.forEach((_name, step) => {
      expect(routeHash('drive', step)).toMatch(/^#lab\/[a-z-]+$/)
      expect(readRoute(routeHash('drive', step))).toEqual({ view: 'drive', step })
    })
  })
  it('nenhum hash guarda mais do que a tela e o passo', () => {
    for (const view of VIEWS) for (let step = 0; step < STEPS.length; step++) expect(routeHash(view, step)).toMatch(/^(#[a-z-]+(\/[a-z-]+)?)?$/)
  })
})
