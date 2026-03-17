# 実装計画

## 1. 前提

- 実装はユーザー承認後に開始する
- MVP では過剰な抽象化を避ける
- まずは仕様固定を優先し、コードは後から合わせる
- JSON を正式成果物とする

## 2. マイルストーン

### Milestone 1: CLI 土台、schema、fixture、artifact 保存

目的:

- プロジェクトの最小実行単位を作る
- 入出力スキーマと保存形式を固定する
- サンプルと fixture を並べる

範囲:

- Node.js + TypeScript の最小構成
- CLI エントリーポイント
- note / brief / spoken script / eleven v3 prompt / qa report の schema 定義
- `artifacts/<run-name>/` の保存仕様
- `samples/` と `tests/fixtures/` の雛形

Acceptance criteria:

- CLI から `--input` と `--output` を受け取り、正常終了できる
- `--stage` と `--from` の許可値がバリデーションされる
- `00-source-note.json` と `manifest.json` が保存される
- `manifest.json` に planned stage files が記録される
- サンプル 3 件が配置されている

Validation commands:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run cli -- generate --input ./samples/note-01.md --output ./artifacts/sample-01 --mock
```

Stop-and-fix rule:

- 上のコマンドのいずれかが失敗したら、Milestone 2 に進まず失敗原因を修正する
- `manifest.json` と `00-source-note.json` の構造が `spec.md` とずれた場合も先へ進まない

### Milestone 2: 4段パイプラインのモック実装と統合テスト

目的:

- 1 発変換ではなく、4段を独立に流せる形を作る
- 実 LLM 接続前でも一連の成果物が生成される状態にする

範囲:

- `note -> brief`
- `brief -> spoken script`
- `spoken script -> eleven v3 prompt`
- `qa`
- モック生成ロジック
- 段単位の再実行
- 統合テスト

Acceptance criteria:

- サンプル 3 件から 4 成果物がモックで生成される
- `--stage` と `--from` で段単位の再実行ができる
- `qa report` が pass / fail を返せる
- 統合テストでファイル出力と再実行パスが検証される

Validation commands:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run cli -- generate --input ./samples/note-01.md --output ./artifacts/sample-01 --mock
npm run cli -- qa --output ./artifacts/sample-01
```

Stop-and-fix rule:

- モックでも 4 成果物が揃わない場合は実 LLM 接続へ進まない
- 再実行で前段 artifact を誤って壊す場合は先にそこを修正する
- QA の exit code と `overall_pass` の整合が取れない場合も先へ進まない

### Milestone 3: 実 LLM 接続、QA 評価、README 整備

目的:

- モックから実用フローへ上げる
- 品質評価を自動化する
- 非エンジニアでも使える状態にする

範囲:

- 実 LLM 接続
- プロンプトテンプレート実装
- QA ルーブリック採点
- README の使用方法
- 入出力例の記載
- lint / typecheck / test の固定

Acceptance criteria:

- サンプル 3 件が実 LLM 接続で 4 成果物まで生成できる
- `qa report` に段階別の修正提案が入る
- README に CLI 例、入出力例、修正の見方が書かれている
- build / lint / typecheck / test が通る

Validation commands:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run cli -- generate --input ./samples/note-01.md --output ./artifacts/sample-01
npm run cli -- qa --output ./artifacts/sample-01
```

Stop-and-fix rule:

- 実 LLM 接続でサンプル 3 件のどれかが不安定なら README 整備より先に安定化する
- QA が false positive / false negative を多発させるなら品質調整を優先する
- README の記述と実際のコマンドがずれた場合はドキュメントを先に修正する

## 3. 最小ファイル構成案

MVP ではファイルを増やしすぎず、段階分離だけは明確に保つ。

```text
/
  AGENTS.md
  spec.md
  plans.md
  README.md
  package.json
  tsconfig.json
  biome.json
  vitest.config.ts

  src/
    cli.ts
    pipeline.ts
    note.ts
    artifacts.ts
    types.ts

  samples/
    note-01.md
    note-02.md
    note-03.md

  tests/
    unit/
    integration/
```

補足:

- provider 抽象化ファイルは Milestone 3 まで作らない
- 設定ファイルは MVP では単一ファイルまたはソース内定数に寄せる
- Markdown 出力は必須にしない

## 4. 実装順

1. Milestone 1 の土台だけを作る
2. Milestone 2 でモックの4段パイプラインを通す
3. Milestone 3 で実 LLM と QA を接続する
4. 最後に README を整備する

## 5. 保留事項

- CLI の公開コマンド名を `note2voice` で固定するか
- 入力 note の front matter を必須にするか
- 実 LLM 接続先をどれにするか
