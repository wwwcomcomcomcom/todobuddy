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
            padding: const EdgeInsets.only(bottom: 24),
            itemCount: widget.board.categories.length,
            separatorBuilder: (_, __) => const SizedBox(height: 28),
            itemBuilder: (context, index) {
              final category = widget.board.categories[index];
              return _CategorySection(
                category: category,
                showOwner: showOwner,
                composing: _composingCategoryId == category.id,
                onStartCompose: () => setState(() => _composingCategoryId = category.id),
                onEndCompose: () => setState(() => _composingCategoryId = null),
              );
            },
          ),
        ),
        if (state.isOwnScope) ...[
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: widget.onManageCategories,
                icon: const Icon(Icons.format_list_bulleted_rounded, size: 18),
                label: const Text('리스트 메뉴'),
                style: TextButton.styleFrom(foregroundColor: AppColors.ink),
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
            Flexible(child: _CategoryPill(category: category, onAdd: category.editable ? onStartCompose : null)),
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
        const SizedBox(height: 12),
        if (category.todos.isEmpty && !composing)
          Padding(
            padding: const EdgeInsets.only(left: 14, top: 2, bottom: 2),
            child: Text(
              category.editable ? '+ 를 눌러 오늘 할 일을 더해보세요' : '아직 등록된 할 일이 없어요',
              style: const TextStyle(color: AppColors.subtle, fontSize: 13),
            ),
          ),
        for (final todo in category.todos) _TodoRow(todo: todo, category: category),
        if (composing)
          _TodoComposer(
            color: category.color,
            onSubmit: (title) => state.addTodo(category.id, title),
            onClose: onEndCompose,
          ),
      ],
    );
  }
}

class _CategoryPill extends StatelessWidget {
  const _CategoryPill({required this.category, this.onAdd});

  final Category category;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: AppColors.chipBg, borderRadius: BorderRadius.all(Radius.circular(24))),
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(category.visibility.icon, size: 17, color: AppColors.subtle),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              category.name,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: category.color),
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
                child: const SizedBox(width: 28, height: 28, child: Icon(Icons.add_rounded, size: 18)),
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
  const _TodoRow({required this.todo, required this.category});

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
            _Checkbox(
              color: widget.category.color,
              checked: widget.todo.done,
              onTap: editable ? () => state.toggleTodo(widget.todo) : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: GestureDetector(
                onDoubleTap: editable ? () => setState(() => _editing = true) : null,
                child: Text(
                  widget.todo.title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: widget.todo.done ? AppColors.subtle : AppColors.ink,
                    decoration: widget.todo.done ? TextDecoration.lineThrough : null,
                    decorationColor: AppColors.subtle,
                  ),
                ),
              ),
            ),
            if (editable && _hovered) ...[
              _MiniAction(icon: Icons.edit_outlined, tooltip: '이름 바꾸기', onTap: () => setState(() => _editing = true)),
              _MiniAction(icon: Icons.close_rounded, tooltip: '삭제', onTap: () => state.deleteTodo(widget.todo)),
            ],
          ],
        ),
      ),
    );
  }
}

class _Checkbox extends StatelessWidget {
  const _Checkbox({required this.color, required this.checked, this.onTap});

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
            width: 28,
            height: 28,
            color: checked ? color : AppColors.blob,
            child: checked ? const Icon(Icons.check_rounded, size: 18, color: Colors.white) : null,
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
  Widget build(BuildContext context) => IconButton(
        icon: Icon(icon, size: 16),
        tooltip: tooltip,
        color: AppColors.subtle,
        visualDensity: VisualDensity.compact,
        onPressed: onTap,
      );
}

/// 새 TODO 입력 / 기존 TODO 이름 수정에 함께 쓰는 한 줄 입력기.
class _TodoComposer extends StatefulWidget {
  const _TodoComposer({
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _controller.text.trim();
    if (title.isEmpty) {
      widget.onClose();
      return;
    }
    await widget.onSubmit(title);
    if (!mounted) return;
    // 새 항목을 연달아 적을 수 있도록 입력창을 비우고 유지한다. 수정 모드는 바로 닫는다.
    if (widget.initialText != null) {
      widget.onClose();
    } else {
      _controller.clear();
      _focus.requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          ClipPath(
            clipper: const _SquircleClipper(),
            child: Container(width: 28, height: 28, color: widget.color.withValues(alpha: 0.25)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: TextField(
              controller: _controller,
              focusNode: _focus,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: '할 일을 입력하고 Enter',
                hintStyle: TextStyle(color: AppColors.subtle, fontWeight: FontWeight.w400),
              ),
              onSubmitted: (_) => _submit(),
              onTapOutside: (_) => widget.onClose(),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 16),
            color: AppColors.subtle,
            visualDensity: VisualDensity.compact,
            onPressed: widget.onClose,
          ),
        ],
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
