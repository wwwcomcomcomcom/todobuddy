import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'avatar.dart';

/// 오른쪽 열: 선택한 날짜의 카테고리별 TODO 목록.
class TodoColumn extends StatefulWidget {
  const TodoColumn({super.key, required this.board, required this.onManageCategories});

  final Board board;
  final VoidCallback onManageCategories;

  @override
  State<TodoColumn> createState() => _TodoColumnState();
}

class _TodoColumnState extends State<TodoColumn> {
  /// 지금 새 TODO 입력창이 열려 있는 카테고리.
  int? _composingCategoryId;

  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();
    final showOwner = widget.board.profile.isCrew;

    if (widget.board.categories.isEmpty) {
      return _EmptyState(isOwn: state.isOwnScope, onCreate: widget.onManageCategories);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.only(bottom: 20),
            itemCount: widget.board.categories.length,
            separatorBuilder: (_, __) => const SizedBox(height: 20),
            itemBuilder: (context, index) {
              final category = widget.board.categories[index];
              return _CategorySection(
                key: ValueKey(category.id),
                category: category,
                showOwner: showOwner,
                composing: _composingCategoryId == category.id,
                onStartCompose: () => setState(() => _composingCategoryId = category.id),
                onEndCompose: () {
                  if (_composingCategoryId == category.id) {
                    setState(() => _composingCategoryId = null);
                  }
                },
              );
            },
          ),
        ),
        if (state.isOwnScope) ...[
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: widget.onManageCategories,
                icon: const Icon(Icons.format_list_bulleted_rounded, size: 16),
                label: const Text('리스트 메뉴'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.ink,
                  textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(fontSize: 13),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({
    super.key,
    required this.category,
    required this.showOwner,
    required this.composing,
    required this.onStartCompose,
    required this.onEndCompose,
  });

  final Category category;
  final bool showOwner;
  final bool composing;
  final VoidCallback onStartCompose;
  final VoidCallback onEndCompose;

  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(child: CategoryPill(category: category, onAdd: category.editable ? onStartCompose : null)),
            if (showOwner) ...[
              const SizedBox(width: 10),
              Avatar(
                name: category.ownerName ?? '',
                imageUrl: state.api.resolveUrl(category.ownerAvatarUrl),
                size: 24,
              ),
              const SizedBox(width: 6),
              Text(category.ownerName ?? '',
                  style: const TextStyle(fontSize: 12, color: AppColors.subtle, fontWeight: FontWeight.w600)),
            ],
          ],
        ),
        const SizedBox(height: 8),
        if (category.todos.isEmpty && !composing)
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 2, bottom: 2),
            child: Text(
              category.editable ? '+ 를 눌러 오늘 할 일을 더해보세요' : '아직 등록된 할 일이 없어요',
              style: const TextStyle(color: AppColors.subtle, fontSize: 12),
            ),
          ),
        for (final todo in category.todos) _TodoRow(key: ValueKey(todo.id), todo: todo, category: category),
        if (composing)
          _TodoComposer(
            key: ValueKey('compose-${category.id}'),
            color: category.color,
            onSubmit: (title) => state.addTodo(category.id, title),
            onClose: onEndCompose,
          ),
      ],
    );
  }
}

/// 카테고리 이름·색·공개설정 아이콘을 보여주는 칩. 미리보기 화면에서도 재사용한다.
class CategoryPill extends StatelessWidget {
  const CategoryPill({super.key, required this.category, this.onAdd});

  final Category category;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: AppColors.chipBg, borderRadius: BorderRadius.all(Radius.circular(24))),
      padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(category.visibility.icon, size: 15, color: AppColors.subtle),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              category.name,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: category.color),
            ),
          ),
          const SizedBox(width: 8),
          if (onAdd != null)
            Material(
              color: Colors.white,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onAdd,
                child: const SizedBox(width: 24, height: 24, child: Icon(Icons.add_rounded, size: 16)),
              ),
            )
          else
            const SizedBox(width: 4),
        ],
      ),
    );
  }
}

class _TodoRow extends StatefulWidget {
  const _TodoRow({super.key, required this.todo, required this.category});

  final Todo todo;
  final Category category;

  @override
  State<_TodoRow> createState() => _TodoRowState();
}

class _TodoRowState extends State<_TodoRow> {
  bool _hovered = false;
  bool _editing = false;

  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();
    final editable = widget.category.editable;

    if (_editing) {
      return _TodoComposer(
        color: widget.category.color,
        initialText: widget.todo.title,
        onSubmit: (title) => state.renameTodo(widget.todo, title),
        onClose: () => setState(() => _editing = false),
      );
    }

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            TodoCheckbox(
              color: widget.category.color,
              checked: widget.todo.done,
              onTap: editable ? () => state.toggleTodo(widget.todo) : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onDoubleTap: editable ? () => setState(() => _editing = true) : null,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 22),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      widget.todo.title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: widget.todo.done ? AppColors.subtle : AppColors.ink,
                        decoration: widget.todo.done ? TextDecoration.lineThrough : null,
                        decorationColor: AppColors.subtle,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (editable)
              SizedBox(
                width: 56,
                child: _hovered
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _MiniAction(icon: Icons.edit_outlined, tooltip: '이름 바꾸기', onTap: () => setState(() => _editing = true)),
                          _MiniAction(icon: Icons.close_rounded, tooltip: '삭제', onTap: () => state.deleteTodo(widget.todo)),
                        ],
                      )
                    : null,
              ),
          ],
        ),
      ),
    );
  }
}

/// 체크 상태를 보여주는 스퀘어클 체크박스. 미리보기 화면에서도 재사용한다.
class TodoCheckbox extends StatelessWidget {
  const TodoCheckbox({super.key, required this.color, required this.checked, this.onTap});

  final Color color;
  final bool checked;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: MouseRegion(
        cursor: onTap == null ? SystemMouseCursors.basic : SystemMouseCursors.click,
        child: ClipPath(
          clipper: const _SquircleClipper(),
          child: Container(
            width: 22,
            height: 22,
            color: checked ? color : AppColors.blob,
            child: checked ? const Icon(Icons.check_rounded, size: 15, color: Colors.white) : null,
          ),
        ),
      ),
    );
  }
}

class _SquircleClipper extends CustomClipper<Path> {
  const _SquircleClipper();

  @override
  Path getClip(Size size) => const SquircleBorder().getOuterPath(Offset.zero & size);

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _MiniAction extends StatelessWidget {
  const _MiniAction({required this.icon, required this.tooltip, required this.onTap});

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 28,
        height: 22,
        child: IconButton(
          icon: Icon(icon, size: 16),
          tooltip: tooltip,
          color: AppColors.subtle,
          padding: EdgeInsets.zero,
          visualDensity: VisualDensity.compact,
          onPressed: onTap,
        ),
      );
}

/// 새 TODO 입력 / 기존 TODO 이름 수정에 함께 쓰는 한 줄 입력기.
class _TodoComposer extends StatefulWidget {
  const _TodoComposer({
    super.key,
    required this.color,
    required this.onSubmit,
    required this.onClose,
    this.initialText,
  });

  final Color color;
  final Future<void> Function(String title) onSubmit;
  final VoidCallback onClose;
  final String? initialText;

  @override
  State<_TodoComposer> createState() => _TodoComposerState();
}

class _TodoComposerState extends State<_TodoComposer> {
  late final _controller = TextEditingController(text: widget.initialText);
  final _focus = FocusNode();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.initialText != null) {
        _controller.selection = TextSelection(baseOffset: 0, extentOffset: _controller.text.length);
      }
      _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit({bool closeAfterSubmit = false}) async {
    if (_submitting) {
      if (closeAfterSubmit) widget.onClose();
      return;
    }
    final title = _controller.text.trim();
    if (title.isEmpty) {
      widget.onClose();
      return;
    }
    setState(() => _submitting = true);
    final onSubmit = widget.onSubmit;
    // 바깥 클릭은 바로 닫아 클릭한 곳의 동작과 포커스를 유지한다.
    if (closeAfterSubmit) widget.onClose();
    try {
      await onSubmit(title);
      if (!mounted || closeAfterSubmit) return;
      // Enter로 새 항목을 연달아 적을 수 있도록 입력창을 비우고 유지한다.
      if (widget.initialText != null) {
        widget.onClose();
      } else {
        _controller.clear();
        _focus.requestFocus();
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return TextFieldTapRegion(
      groupId: _focus,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            ClipPath(
              clipper: const _SquircleClipper(),
              child: Container(width: 22, height: 22, color: widget.color.withValues(alpha: 0.25)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Stack(
                alignment: Alignment.centerLeft,
                children: [
                  // 여러 줄 제목도 수정 전의 행 높이를 유지한다.
                  if (widget.initialText != null)
                    IgnorePointer(
                      child: Opacity(
                        opacity: 0,
                        child: Text(
                          widget.initialText!,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ),
                  TextField(
                    groupId: _focus,
                    controller: _controller,
                    focusNode: _focus,
                    readOnly: _submitting,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, height: 20 / 14),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                      constraints: BoxConstraints(minHeight: 22),
                      border: InputBorder.none,
                      hintText: '할 일을 입력하고 Enter',
                      hintStyle: TextStyle(color: AppColors.subtle, fontWeight: FontWeight.w400),
                    ),
                    onSubmitted: (_) => _submit(),
                    onEditingComplete: () {},
                    onTapOutside: (_) => _submit(closeAfterSubmit: true),
                  ),
                ],
              ),
            ),
            SizedBox(
              width: 56,
              child: Align(
                alignment: Alignment.centerRight,
                child: _MiniAction(icon: Icons.close_rounded, tooltip: '작성 취소', onTap: widget.onClose),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.isOwn, required this.onCreate});

  final bool isOwn;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inbox_rounded, size: 44, color: AppColors.blob),
            const SizedBox(height: 12),
            Text(
              isOwn ? '아직 카테고리가 없어요' : '공유된 카테고리가 없어요',
              style: const TextStyle(color: AppColors.subtle, fontWeight: FontWeight.w600),
            ),
            if (isOwn) ...[
              const SizedBox(height: 12),
              FilledButton(
                onPressed: onCreate,
                style: FilledButton.styleFrom(backgroundColor: AppColors.ink),
                child: const Text('카테고리 등록'),
              ),
            ],
          ],
        ),
      );
}
