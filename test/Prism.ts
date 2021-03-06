import * as assert from 'assert'
import { pipe } from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as E from 'fp-ts/lib/Either'
import * as _ from '../src/Prism'
import { Optional } from '../src/Optional'
import * as A from 'fp-ts/lib/ReadonlyArray'
import * as T from '../src/Traversal'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

type Leaf = { _tag: 'Leaf' }
type Node = { _tag: 'Node'; value: number; left: Tree; right: Tree }
type Tree = Leaf | Node

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

const leaf: Tree = { _tag: 'Leaf' }
const node = (value: number, left: Tree, right: Tree): Tree => ({ _tag: 'Node', value, left, right })

// -------------------------------------------------------------------------------------
// primitives
// -------------------------------------------------------------------------------------

const value: _.Prism<Tree, number> = {
  getOption: (s) => (s._tag === 'Node' ? O.some(s.value) : O.none),
  reverseGet: (a) => node(a, leaf, leaf)
}

describe('Prism', () => {
  describe('pipeables', () => {
    it('imap', () => {
      const sa = pipe(
        value,
        _.imap(
          (n) => String(n),
          (s) => parseFloat(s)
        )
      )
      assert.deepStrictEqual(sa.getOption(leaf), O.none)
      assert.deepStrictEqual(sa.getOption(node(1, leaf, leaf)), O.some('1'))
      assert.deepStrictEqual(sa.reverseGet('1'), node(1, leaf, leaf))
    })
  })

  describe('instances', () => {
    it('compose', () => {
      type S = O.Option<Tree>
      const sa = pipe(_.id<S>(), _.some)
      const ab = value
      const sb = _.categoryPrism.compose(ab, sa)
      assert.deepStrictEqual(sb.getOption(O.none), O.none)
      assert.deepStrictEqual(sb.getOption(O.some(leaf)), O.none)
      assert.deepStrictEqual(sb.getOption(O.some(node(1, leaf, leaf))), O.some(1))
      assert.deepStrictEqual(sb.reverseGet(1), O.some(node(1, leaf, leaf)))
    })
  })

  it('id', () => {
    const ss = _.id<Tree>()
    assert.deepStrictEqual(ss.getOption(leaf), O.some(leaf))
    assert.deepStrictEqual(ss.reverseGet(leaf), leaf)
  })

  it('modify', () => {
    const modify = pipe(
      value,
      _.modify((value) => value * 2)
    )
    assert.deepStrictEqual(modify(leaf), leaf)
    assert.deepStrictEqual(modify(node(1, leaf, leaf)), node(2, leaf, leaf))
  })

  it('modifyOption', () => {
    const modifyOption = pipe(
      value,
      _.modifyOption((value) => value * 2)
    )
    assert.deepStrictEqual(modifyOption(leaf), O.none)
    assert.deepStrictEqual(modifyOption(node(1, leaf, leaf)), O.some(node(2, leaf, leaf)))
  })

  it('prop', () => {
    type S = O.Option<{ a: string; b: number }>
    const sa = pipe(_.id<S>(), _.some, _.prop('a'))
    assert.deepStrictEqual(sa.getOption(O.none), O.none)
    assert.deepStrictEqual(sa.getOption(O.some({ a: 'a', b: 1 })), O.some('a'))
  })

  it('props', () => {
    type S = O.Option<{ a: string; b: number; c: boolean }>
    const sa = pipe(_.id<S>(), _.some, _.props('a', 'b'))
    assert.deepStrictEqual(sa.getOption(O.none), O.none)
    assert.deepStrictEqual(sa.getOption(O.some({ a: 'a', b: 1, c: true })), O.some({ a: 'a', b: 1 }))
  })

  it('component', () => {
    type S = O.Option<[string, number]>
    const sa = pipe(_.id<S>(), _.some, _.component(1))
    assert.deepStrictEqual(sa.getOption(O.none), O.none)
    assert.deepStrictEqual(sa.getOption(O.some(['a', 1])), O.some(1))
  })

  it('index', () => {
    const sa = pipe(_.id<ReadonlyArray<number>>(), _.index(0))
    assert.deepStrictEqual(sa.getOption([1, 2, 3]), O.some(1))
  })

  it('key', () => {
    const sa = pipe(_.id<Readonly<Record<string, number>>>(), _.key('k'))
    assert.deepStrictEqual(sa.getOption({ k: 1, j: 2 }), O.some(1))
  })

  it('compose', () => {
    type S = O.Option<Tree>
    const sa = pipe(_.id<S>(), _.some)
    const ab = value
    const sb = pipe(sa, _.compose(ab))
    assert.deepStrictEqual(sb.getOption(O.none), O.none)
    assert.deepStrictEqual(sb.getOption(O.some(leaf)), O.none)
    assert.deepStrictEqual(sb.getOption(O.some(node(1, leaf, leaf))), O.some(1))
    assert.deepStrictEqual(sb.reverseGet(1), O.some(node(1, leaf, leaf)))
  })

  it('composeOptional', () => {
    type S = O.Option<string>
    const sa = pipe(_.id<S>(), _.some)
    const ab: Optional<string, string> = {
      getOption: (s) => (s.length > 0 ? O.some(s[0]) : O.none),
      set: (a) => (s) => (s.length > 0 ? a + s.substring(1) : s)
    }
    const sb = pipe(sa, _.composeOptional(ab))
    assert.deepStrictEqual(sb.getOption(O.none), O.none)
    assert.deepStrictEqual(sb.getOption(O.some('')), O.none)
    assert.deepStrictEqual(sb.getOption(O.some('ab')), O.some('a'))
    assert.deepStrictEqual(sb.set('c')(O.none), O.none)
    assert.deepStrictEqual(sb.set('c')(O.some('')), O.some(''))
    assert.deepStrictEqual(sb.set('c')(O.some('ab')), O.some('cb'))
  })

  it('right', () => {
    type S = E.Either<string, number>
    const sa = pipe(_.id<S>(), _.right)
    assert.deepStrictEqual(sa.getOption(E.right(1)), O.some(1))
    assert.deepStrictEqual(sa.getOption(E.left('a')), O.none)
    assert.deepStrictEqual(sa.reverseGet(2), E.right(2))
  })

  it('left', () => {
    type S = E.Either<string, number>
    const sa = pipe(_.id<S>(), _.left)
    assert.deepStrictEqual(sa.getOption(E.right(1)), O.none)
    assert.deepStrictEqual(sa.getOption(E.left('a')), O.some('a'))
    assert.deepStrictEqual(sa.reverseGet('b'), E.left('b'))
  })

  it('atKey', () => {
    type S = Readonly<Record<string, number>>
    const sa = pipe(_.id<S>(), _.atKey('a'))
    assert.deepStrictEqual(sa.getOption({ a: 1 }), O.some(O.some(1)))
    assert.deepStrictEqual(sa.set(O.some(2))({ a: 1, b: 2 }), { a: 2, b: 2 })
    assert.deepStrictEqual(sa.set(O.some(1))({ b: 2 }), { a: 1, b: 2 })
    assert.deepStrictEqual(sa.set(O.none)({ a: 1, b: 2 }), { b: 2 })
  })

  it('filter', () => {
    type S = O.Option<number>
    const sa = pipe(
      _.id<S>(),
      _.some,
      _.filter((n) => n > 0)
    )
    assert.deepStrictEqual(sa.getOption(O.some(1)), O.some(1))
    assert.deepStrictEqual(sa.getOption(O.some(-1)), O.none)
    assert.deepStrictEqual(sa.getOption(O.none), O.none)
    assert.deepStrictEqual(sa.reverseGet(2), O.some(2))
    assert.deepStrictEqual(sa.reverseGet(-1), O.some(-1))
  })

  it('findFirst', () => {
    type S = O.Option<ReadonlyArray<number>>
    const sa = pipe(
      _.id<S>(),
      _.some,
      _.findFirst((n) => n > 0)
    )
    assert.deepStrictEqual(sa.getOption(O.none), O.none)
    assert.deepStrictEqual(sa.getOption(O.some([])), O.none)
    assert.deepStrictEqual(sa.getOption(O.some([-1, -2, -3])), O.none)
    assert.deepStrictEqual(sa.getOption(O.some([-1, 2, -3])), O.some(2))
    assert.deepStrictEqual(sa.set(3)(O.none), O.none)
    assert.deepStrictEqual(sa.set(3)(O.some([])), O.some([]))
    assert.deepStrictEqual(sa.set(3)(O.some([-1, -2, -3])), O.some([-1, -2, -3]))
    assert.deepStrictEqual(sa.set(3)(O.some([-1, 2, -3])), O.some([-1, 3, -3]))
    assert.deepStrictEqual(sa.set(4)(O.some([-1, -2, 3])), O.some([-1, -2, 4]))
  })

  it('traverse', () => {
    type S = O.Option<ReadonlyArray<string>>
    const sa = pipe(_.id<S>(), _.some, _.traverse(A.readonlyArray))
    const modify = pipe(
      sa,
      T.modify((s) => s.toUpperCase())
    )
    assert.deepStrictEqual(modify(O.some(['a'])), O.some(['A']))
  })

  it('fromNullable', () => {
    type S = O.Option<number | undefined>
    const sa = pipe(_.id<S>(), _.some, _.fromNullable)
    assert.deepStrictEqual(sa.getOption(O.none), O.none)
    assert.deepStrictEqual(sa.getOption(O.some(undefined)), O.none)
    assert.deepStrictEqual(sa.getOption(O.some(1)), O.some(1))
    assert.deepStrictEqual(sa.reverseGet(1), O.some(1))
  })

  it('modifyF', () => {
    const f = pipe(
      value,
      _.modifyF(O.Applicative)((n) => (n > 0 ? O.some(n * 2) : O.none))
    )
    assert.deepStrictEqual(f(node(1, leaf, leaf)), O.some(node(2, leaf, leaf)))
    assert.deepStrictEqual(f(leaf), O.some(leaf))
    assert.deepStrictEqual(f(node(-1, leaf, leaf)), O.none)
  })
})
