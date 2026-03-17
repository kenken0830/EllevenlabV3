# ノートから ElevenLabs v3 用の音声プロンプトを生成するツール 仕様

## 1. 目的

日本語のノートやメモを入力として、以下の4成果物を段階的に生成する。

1. `brief`
2. `spoken script`
3. `eleven v3 prompt`
4. `qa report`

このプロジェクトの目的は、説明っぽい読みではなく、フランクで聞きやすく、引き込みがある話し方に寄せた音声用素材を作ることにある。

MVP では過剰な抽象化を避け、まずは次を優先する。

- 4段パイプラインを明示的に分離すること
- 出力を JSON 正式版として保存すること
- どの段を直せば品質が上がるかが分かること
- 非エンジニアでもコマンドで実行しやすいこと

## 2. スコープ

### 2.1 MVP に含む

- CLI 実行
- UTF-8 日本語ノート入力
- `note -> brief -> spoken script -> eleven -> qa` の段階実行
- 各段の JSON 保存
- サンプル3件
- モックでも動く統合パイプライン
- 実 LLM 接続の差し替え余地

### 2.2 MVP で後回し

- 複数 LLM provider の抽象化
- 設定ファイルの細分化
- GUI
- 音声生成 API そのものの実行
- 高度なテンプレート管理

## 3. CLI コマンド例

MVP の CLI 名は仮に `note2voice` とする。開発時は `npm run` 経由でも同等に呼べることを前提にする。

### 3.1 全段実行

```bash
note2voice generate --input ./samples/note-01.md --output ./artifacts/sample-01
```

### 3.2 途中段から再実行

```bash
note2voice generate --input ./samples/note-01.md --output ./artifacts/sample-01 --from brief
```

意図:

- `brief.json` を手修正した後、`spoken script` 以降だけ再生成できる

### 3.3 1段だけ実行

```bash
note2voice generate --input ./samples/note-01.md --output ./artifacts/sample-01 --stage brief
```

### 3.4 QA のみ再実行

```bash
note2voice qa --output ./artifacts/sample-01
```

### 3.5 サンプル一括生成

```bash
note2voice generate-samples
```

### 3.6 CLI オプション契約

`generate` コマンドの許可値は次のとおり。

- `--stage`
  - `brief`
  - `spoken-script`
  - `eleven-v3-prompt`
  - `qa`
- `--from`
  - `brief`
  - `spoken-script`
  - `eleven-v3-prompt`
  - `qa`

ルール:

- `--stage` と `--from` は同時に指定できない
- どちらも未指定なら 4 段すべてを対象にする
- `--stage` は指定した 1 段だけを対象にする
- `--from` は指定した段から後ろの段を対象にする
- `--mock` を付けた場合、LLM 呼び出しが必要な段は外部 API を叩かず、決定的な placeholder または stub を返す
- Milestone 1 では skeleton 出力のみのため、実質的に mock 相当の挙動になる

### 3.7 失敗時の終了条件

- exit code `0`
  - 正常終了
  - `qa` の場合は `overall_pass = true`
- exit code `1`
  - 不正な引数
  - 入力ファイル未存在
  - 必須 artifact 不足
  - note 解析失敗
  - JSON 読み書き失敗
  - schema 不整合
- exit code `2`
  - `qa report` は生成または読み込みできたが `overall_pass = false`

### 3.8 QA の pass / fail の扱い

- `generate` が QA 段まで実行した場合、`04-qa-report.json` は常に保存する
- QA が fail でも、それ以前の成果物は保持する
- QA fail 時は `generate` も `qa` も exit code `2` を返す
- QA pass / fail の最終判定は `qa report.overall_pass` を正とする

## 4. 入力 note の仕様

### 4.1 受け入れ形式

- UTF-8 の `.md` または `.txt`
- 基本は本文のみでよい
- 任意で YAML front matter を付与可能

### 4.2 推奨入力形式

```md
---
id: note-01
title: タスクが多すぎて動けない日の話
audience: 仕事や家事に追われて頭がいっぱいな人
source: memo
---

やることが多い日に、何から手をつけていいか分からなくなることがある。
そのままSNSを見てしまって、さらに自己嫌悪になる。
でも本当は、やる気の問題というより、頭の中の負荷が高すぎるだけかもしれない。
最初の一歩は、全部を頑張ることではなく、1個だけ見える状態にすることだと思う。
```

### 4.3 入力 note の意味論

入力 note は以下を満たすことを想定する。

- 日本語である
- メモ書きでもよい
- 文体の粗さは許容する
- 論理が完全でなくてもよい
- 後段で整理可能な程度の主題がある

### 4.4 最低限必要な情報

- 伝えたい中心テーマが読み取れること
- 音声化したい内容が 2 文以上あること

## 5. 4段の出力仕様

### 5.1 brief

`brief` は、元ノートを「どう話すか」の設計図へ圧縮した中間成果物である。

必須要件:

- 元 note の主張を要約する
- 冒頭で共感から入る角度を持つ
- 説明臭くなりやすい箇所を認識する
- 話の流れを 3 から 6 セクション程度に整理する

必須フィールド:

- `artifact_type`
- `version`
- `source_note`
- `core_message`
- `listener_problem`
- `empathy_hook`
- `talking_points`
- `section_plan`
- `style_targets`
- `style_avoid`

#### brief JSON 例

```json
{
  "artifact_type": "brief",
  "version": "0.1",
  "source_note": {
    "id": "note-01",
    "title": "タスクが多すぎて動けない日の話"
  },
  "core_message": "動けない日は怠けではなく、頭の中の負荷が上がりすぎていることが多い。最初の一歩は全部を片づけることではなく、1個だけ見える状態にすること。",
  "listener_problem": "やることが多すぎて固まり、自己嫌悪に入ってしまう。",
  "empathy_hook": "今日も何も進まなかった、って自分を責めたくなる日、ありますよね。",
  "talking_points": [
    "動けない原因を気合い不足と決めつけない",
    "情報量が多いと脳が止まりやすい",
    "最初は1個だけ見えるようにする"
  ],
  "section_plan": [
    {
      "id": "intro",
      "goal": "聞き手の自己嫌悪に寄り添う",
      "points": [
        "進まない日に自分を責める感覚",
        "その苦しさを先に受け止める"
      ]
    },
    {
      "id": "body",
      "goal": "原因の見立てを言い換える",
      "points": [
        "やる気ではなく負荷の問題",
        "頭の中にタブが開きすぎている状態"
      ]
    },
    {
      "id": "close",
      "goal": "すぐ試せる小さい行動で終える",
      "points": [
        "1個だけ紙に出す",
        "全部やろうとしない"
      ]
    }
  ],
  "style_targets": [
    "フランク",
    "聞き手に近い距離感",
    "共感から入る"
  ],
  "style_avoid": [
    "講義調",
    "過剰な一般論",
    "断定しすぎる説教口調"
  ]
}
```

### 5.2 spoken script

`spoken script` は、brief を自然な口語へ落とし込んだ台本である。

必須要件:

- 冒頭は共感または状況代弁から始める
- 1文ごとに不自然に止まりすぎない
- 説明のための説明を減らす
- 読み上げた時に息継ぎしやすい長さにする

必須フィールド:

- `artifact_type`
- `version`
- `source_brief`
- `voice_intent`
- `sections`
- `closing_takeaway`
- `delivery_cautions`

#### spoken script JSON 例

```json
{
  "artifact_type": "spoken_script",
  "version": "0.1",
  "source_brief": {
    "id": "note-01"
  },
  "voice_intent": "近い距離感で、責めずに、少し気持ちが軽くなる話し方",
  "sections": [
    {
      "id": "intro",
      "purpose": "共感で引き込む",
      "lines": [
        "やることは山ほどあるのに、なぜか一個も触れない日ってありますよね。",
        "で、そのあとに限って、自分ってだめだなって責めたくなる。"
      ]
    },
    {
      "id": "body",
      "purpose": "見立てを言い換える",
      "lines": [
        "でもあれ、やる気がないっていうより、頭の中が混みすぎて止まってるだけだったりします。",
        "タブが開きすぎたブラウザみたいな感じです。"
      ]
    },
    {
      "id": "close",
      "purpose": "小さく着地させる",
      "lines": [
        "だから最初は、全部をどうにかしようとしなくて大丈夫です。",
        "今日やることを一個だけ見える場所に出す。それだけでも、かなり違います。"
      ]
    }
  ],
  "closing_takeaway": "最初の一歩は、全部やることではなく、1個だけ見える状態にすること。",
  "delivery_cautions": [
    "説明しすぎない",
    "文末を毎回きっちり閉じすぎない",
    "過剰な感嘆や三点リーダを避ける"
  ]
}
```

### 5.3 eleven v3 prompt

`eleven v3 prompt` は、spoken script を ElevenLabs v3 向けに演出ルールつきで整形した最終成果物である。

必須要件:

- 日本語読み上げ前提
- フランクで聞きやすく、引き込みがある方向性を明示
- Eleven v3 向け演出ルールを script 本文と分離して持つ
- 過剰なタグや不自然な演技指定を避ける

必須フィールド:

- `artifact_type`
- `version`
- `source_script`
- `performance_goal`
- `performance_rules`
- `avoid_rules`
- `final_prompt`

#### eleven v3 prompt JSON 例

```json
{
  "artifact_type": "eleven_v3_prompt",
  "version": "0.1",
  "source_script": {
    "id": "note-01"
  },
  "performance_goal": "フランクで聞きやすく、責めずに引き込む日本語ナレーション",
  "performance_rules": [
    "冒頭は相手の状況を分かっている感じで入る",
    "説明するより、自然に話しかける",
    "感情は大げさに振らず、少しずつ温度を上げる",
    "一文ごとに切りすぎず、会話の流れを保つ"
  ],
  "avoid_rules": [
    "講義っぽい抑揚",
    "過剰な芝居",
    "不自然な長い間",
    "タグの多用",
    "三点リーダの多用"
  ],
  "final_prompt": "Japanese narration. Sound casual, warm, and engaging. Start with empathy, not explanation. Keep the flow conversational and easy to follow. Avoid lecture-like delivery, exaggerated acting, and too many pauses. Script: やることは山ほどあるのに、なぜか一個も触れない日ってありますよね。で、そのあとに限って、自分ってだめだなって責めたくなる。でもあれ、やる気がないっていうより、頭の中が混みすぎて止まってるだけだったりします。タブが開きすぎたブラウザみたいな感じです。だから最初は、全部をどうにかしようとしなくて大丈夫です。今日やることを一個だけ見える場所に出す。それだけでも、かなり違います。"
}
```

### 5.4 qa report

`qa report` は、4段の成果物を評価し、どこを直すべきか示すレポートである。

必須要件:

- 品質評価ルーブリックに沿って採点する
- 問題があれば修正対象の段を明示する
- 「説明っぽさを減らす」観点を独立して評価する
- 自動検証できる項目と主観評価項目を分ける

必須フィールド:

- `artifact_type`
- `version`
- `inputs`
- `scores`
- `checks`
- `issues`
- `revision_guidance`
- `overall_pass`

#### qa report JSON 例

```json
{
  "artifact_type": "qa_report",
  "version": "0.1",
  "inputs": {
    "note_id": "note-01"
  },
  "scores": {
    "hook_strength": {
      "score": 4,
      "reason": "冒頭が聞き手の感情に近く、入りやすい。"
    },
    "low_explainer_tone": {
      "score": 4,
      "reason": "説明口調は抑えられているが、body の2文目はやや比喩説明寄り。"
    },
    "spoken_naturalness": {
      "score": 5,
      "reason": "口語として自然で、読み上げに乗せやすい。"
    },
    "emotion_curve": {
      "score": 4,
      "reason": "自己嫌悪から安心へ流れる温度差がある。"
    },
    "eleven_prompt_naturalness": {
      "score": 4,
      "reason": "演出指示は簡潔で自然。タグ依存もない。"
    }
  },
  "checks": [
    {
      "name": "pipeline_stage_separated",
      "status": "pass"
    },
    {
      "name": "contains_empathy_opening",
      "status": "pass"
    },
    {
      "name": "excessive_ellipsis",
      "status": "pass"
    }
  ],
  "issues": [
    {
      "severity": "medium",
      "stage": "spoken_script",
      "message": "body の比喩が少し説明に寄りやすい。"
    }
  ],
  "revision_guidance": [
    {
      "stage": "spoken_script",
      "action": "body を1文短くして、説明より実感に近い言い回しへ寄せる。"
    }
  ],
  "overall_pass": true
}
```

## 6. ファイル出力先と命名規則

### 6.1 出力ディレクトリ

1 実行ごとに 1 ディレクトリを作る。

```text
artifacts/<run-name>/
```

例:

```text
artifacts/sample-01/
```

### 6.2 出力ファイル

```text
artifacts/sample-01/
  00-source-note.json
  01-brief.json
  02-spoken-script.json
  03-eleven-v3-prompt.json
  04-qa-report.json
  manifest.json
```

### 6.3 命名ルール

- 順序が分かる 2 桁プレフィックスを付ける
- JSON を正式成果物とする
- 人が確認しやすい補助 Markdown は将来追加可
- `manifest.json` に実行時刻、入力ファイル、生成ステージ一覧を記録する

### 6.4 manifest.json の最低フィールド

`manifest.json` には最低限次を持たせる。

- `schema_version`
- `run_name`
- `command`
- `input_file`
- `output_dir`
- `created_at`
- `stage_mode`
- `stages_requested`
- `mock_mode`
- `files`
  - `source_note`
  - `manifest`
  - `planned_stage_files`

#### manifest.json 例

```json
{
  "schema_version": "0.1",
  "run_name": "sample-01",
  "command": "generate",
  "input_file": "D:/Cursor/GouseiShoshi/samples/note-01.md",
  "output_dir": "D:/Cursor/GouseiShoshi/artifacts/sample-01",
  "created_at": "2026-03-14T08:00:00.000Z",
  "stage_mode": "all",
  "stages_requested": [
    "brief",
    "spoken-script",
    "eleven-v3-prompt",
    "qa"
  ],
  "mock_mode": true,
  "files": {
    "source_note": "00-source-note.json",
    "manifest": "manifest.json",
    "planned_stage_files": {
      "brief": "01-brief.json",
      "spoken-script": "02-spoken-script.json",
      "eleven-v3-prompt": "03-eleven-v3-prompt.json",
      "qa": "04-qa-report.json"
    }
  }
}
```

## 7. サンプル入出力

MVP では少なくとも 3 件のサンプルを保持する。実装時には `samples/` と `tests/fixtures/` に配置する。

### 7.1 Sample 01: タスク過多で固まる

#### 入力 note

```md
---
id: note-01
title: タスクが多すぎて動けない日の話
---

やることが多い日に、何から手をつけていいか分からなくなることがある。
そのままSNSを見てしまって、さらに自己嫌悪になる。
でも本当は、やる気の問題というより、頭の中の負荷が高すぎるだけかもしれない。
最初の一歩は、全部を頑張ることではなく、1個だけ見える状態にすることだと思う。
```

#### 期待出力要約

- `brief.core_message`
  - 動けない日は怠けではなく負荷過多という見立て
- `spoken_script.sections[0].lines[0]`
  - 進まない日の自責に共感する導入
- `eleven_v3_prompt.performance_goal`
  - 責めずに軽くする方向
- `qa_report.revision_guidance`
  - 説明が強ければ script 修正を促す

### 7.2 Sample 02: 生成AIが怖い初心者向け

#### 入力 note

```md
---
id: note-02
title: 生成AIを使うのが少し怖い人へ
---

生成AIに興味はあるけど、変なことを聞いたら恥ずかしい気がして触れない人は多いと思う。
でも、最初からうまく使える人なんてほとんどいない。
むしろ雑に聞いて、返ってきたものを見ながら聞き直す方が自然だと思う。
最初のハードルは、正しく聞くことじゃなくて、1回聞いてみることかもしれない。
```

#### 期待出力要約

- `brief.empathy_hook`
  - 触ってみたいけど怖い感覚への共感
- `spoken_script.voice_intent`
  - 恥ずかしさをほぐす近い距離感
- `eleven_v3_prompt.avoid_rules`
  - 上から教える講義調を避ける
- `qa_report.scores.low_explainer_tone.score`
  - 説教感が低いほど高評価

### 7.3 Sample 03: 朝活が続かない

#### 入力 note

```md
---
id: note-03
title: 朝活が3日で止まる理由
---

朝活を始めても、3日くらいで止まってしまうことがある。
自分は意志が弱いのかなと思いやすいけど、最初から理想のメニューを詰め込みすぎているだけかもしれない。
続けるには、頑張る量を増やすより、始めるまでの抵抗を減らす方が大事だと思う。
例えば、机にノートを置いて寝るだけでも次の日のハードルは下がる。
```

#### 期待出力要約

- `brief.listener_problem`
  - 続かない自責
- `spoken_script.closing_takeaway`
  - 抵抗を減らす設計へ着地
- `eleven_v3_prompt.final_prompt`
  - 少しずつ前向きになる感情カーブを含む
- `qa_report.scores.emotion_curve.score`
  - 自責から実行可能感へ動くほど高評価

## 8. 品質評価ルーブリック

各カテゴリを 1 から 5 で採点する。

- 1: かなり弱い
- 2: 弱い
- 3: 許容
- 4: 良い
- 5: とても良い

### 8.1 引き込み

見る観点:

- 冒頭で聞き手の状況や気持ちをつかめているか
- 続きを聞きたくなる入りになっているか

採点目安:

- 1: 冒頭から説明に入っており引きが弱い
- 3: 話題は分かるが、強い引力はない
- 5: 共感と期待が両立していて自然に引き込まれる

### 8.2 説明っぽさの低さ

見る観点:

- 講義調や要点解説調になっていないか
- 「まず、次に、つまり」で固く説明していないか
- 正しさより会話感が優先されているか

採点目安:

- 1: 説明のための説明が多い
- 3: 一部説明調だが許容
- 5: 話しかける感じが自然で、説明臭さがかなり低い

### 8.3 口語の自然さ

見る観点:

- 日本語として話し言葉が自然か
- 書き言葉の硬さが残っていないか
- 不自然な句読点や間が多すぎないか

採点目安:

- 1: 書き言葉をそのまま読んでいる
- 3: 多少硬いが読める
- 5: 人がそのまま話していそうで自然

### 8.4 感情カーブ

見る観点:

- 冒頭から終わりまで感情の流れがあるか
- 聞き手の不安や重さが、少し軽くなる方向へ動くか

採点目安:

- 1: 温度変化がなく平板
- 3: ゆるい変化はある
- 5: 無理なく気持ちが動く

### 8.5 Eleven v3 向け演出の自然さ

見る観点:

- 演出指示が過剰でないか
- タグや記号頼みになっていないか
- 音声モデルが解釈しやすい自然な指示か

採点目安:

- 1: 指示過多で不自然
- 3: 最低限成立している
- 5: 短く自然で、演出意図が明確

### 8.6 合格基準

MVP の `overall_pass` は次を満たした場合に `true` とする。

- 5カテゴリ平均が 4.0 以上
- いずれのカテゴリも 3 未満がない
- 自動チェックに fail がない

## 9. 段階修正の指針

修正時は次の優先順で見る。

- 主張や流れが弱い
  - `brief` を直す
- 口語が硬い、説明っぽい
  - `spoken script` を直す
- 演出が大げさ、不自然
  - `eleven v3 prompt` を直す
- どこを直すべきか曖昧
  - `qa report` の `revision_guidance` を見る

## 10. 非機能要件

- 日本語 UTF-8 を前提とする
- 同じ入力から同じ構造の成果物が得られること
- 各成果物は人が直接編集できる JSON であること
- パイプラインは 1 発変換を禁止し、中間成果物を必ず保存すること
