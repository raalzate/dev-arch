namespace Catalog.Data;

public class BookRepository
{
    private readonly CatalogDbContext _context;

    public BookRepository(CatalogDbContext context)
    {
        _context = context;
    }

    public IEnumerable<Book> All()
    {
        return _context.Books.ToList();
    }
}
