import jinja2

from ._renderer import STATIC, TEMPLATES
from ._cluster import Cluster

def get_home_data(cluster: Cluster) -> str:
    return {
        "SUBMISSIONS": cluster.submissions_as_dict(),
        "LINKS": cluster.links_as_dict()
    }

    with open(TEMPLATES / "home.html") as f:
        template = jinja2.Template(f.read(), autoescape=jinja2.select_autoescape(enabled_extensions=("html",)))
    return template.render(SUBMISSIONS=cluster.submissions_as_dict(), LINKS=cluster.links_as_dict())
