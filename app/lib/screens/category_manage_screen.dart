import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'category_form_screen.dart';

/// 카테고리 관리: 순서를 바꾸고, 편집 화면으로 들어간다.
class CategoryManageScreen extends StatefulWidget {
  const CategoryManageScreen({super.key});

  @override
  State<CategoryManageScreen> createState() => _CategoryManageScreenState();
}

class _CategoryManageScreenState extends State<CategoryManageScreen> {
  List<Category> _categories = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await context.read<AppState>().api.categories();
      if (mounted) setState(() => _categories = list);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm([Category? category]) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => CategoryFormScreen(category: category)),
    );
    await _load();
  }

  Future<void> _reorder(int oldIndex, int newIndex) async {
    setState(() {
      final moved = _categories.removeAt(oldIndex);
      _categories = [..._categories]..insert(newIndex, moved);
    });
    await context.read<AppState>().reorderCategories(_categories.map((c) => c.id).toList());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('카테고리 관리', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.ink))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(24, 12, 24, 24),
                  child: Text('카테고리 항목을 탭하거나 드래그하여 목록을 편집할 수 있습니다.',
                      style: TextStyle(color: AppColors.subtle, fontSize: 14)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    children: [
                      const Text('일반', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: () => _openForm(),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('추가하기'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.chipBg,
                          foregroundColor: AppColors.ink,
                          elevation: 0,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Text(_error!, style: const TextStyle(color: AppColors.sunday)),
                  ),
                Expanded(
                  child: _categories.isEmpty
                      ? const Center(
                          child: Text('아직 카테고리가 없어요', style: TextStyle(color: AppColors.subtle)),
                        )
                      : ReorderableListView.builder(
                          padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                          buildDefaultDragHandles: false,
                          itemCount: _categories.length,
                          onReorderItem: _reorder,
                          itemBuilder: (context, index) {
                            final category = _categories[index];
                            return ReorderableDragStartListener(
                              key: ValueKey(category.id),
                              index: index,
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _CategoryRow(
                                  category: category,
                                  onEdit: () => _openForm(category),
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.category, required this.onEdit});

  final Category category;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final shareCount = category.shares.length;
    return Material(
      color: AppColors.chipBg,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onEdit,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          child: Row(
            children: [
              Icon(category.visibility.icon, size: 18, color: AppColors.subtle),
              const SizedBox(width: 12),
              Flexible(
                child: Text(
                  category.name,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: category.color),
                ),
              ),
              if (category.visibility == CategoryVisibility.shared && shareCount > 0) ...[
                const SizedBox(width: 8),
                Text('$shareCount곳 공유', style: const TextStyle(fontSize: 12, color: AppColors.subtle)),
              ],
              const Spacer(),
              const Icon(Icons.drag_indicator_rounded, size: 18, color: AppColors.blob),
              const SizedBox(width: 10),
              Text('편집', style: TextStyle(color: AppColors.subtle, fontSize: 14, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
