using Catalog.Common;
using Catalog.Data;

namespace Catalog.Services;

public class BookService
{
    private readonly BookRepository _repository;

    public BookService(BookRepository repository)
    {
        _repository = repository;
    }

    public IReadOnlyList<string> Titles()
    {
        return _repository.All().Select(b => TitleHelper.Normalize(b.Title)).ToList();
    }
}
