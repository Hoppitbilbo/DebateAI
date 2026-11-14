// Bibliography of the About page. Entries keep their original language and
// APA style in every locale; only the group titles are translated
// (aboutPage.references.groups.<id>).

export interface Reference {
  text: string;
  url?: string;
}

export interface ReferenceGroup {
  id: "guidelines" | "mit" | "interactive" | "assessment" | "genai";
  items: Reference[];
}

export const ABOUT_REFERENCES: ReferenceGroup[] = [
  {
    id: "guidelines",
    items: [
      {
        text: "UNESCO (2021). AI and education: Guidance for policy-makers (F. Miao, W. Holmes, R. Huang & H. Zhang). UNESCO.",
        url: "https://doi.org/10.54675/PCSP7350",
      },
      {
        text: "UNESCO (2022). Recommendation on the ethics of artificial intelligence. UNESCO.",
        url: "https://unesdoc.unesco.org/ark:/48223/pf0000381137",
      },
      {
        text: "UNESCO (2023). Guidance for generative AI in education and research (F. Miao & W. Holmes). UNESCO.",
        url: "https://doi.org/10.54675/EWZM9535",
      },
      {
        text: "UNESCO (2024). AI competency framework for teachers. UNESCO.",
        url: "https://doi.org/10.54675/ZJTE2084",
      },
      {
        text: "UNESCO (2024). AI competency framework for students. UNESCO.",
        url: "https://doi.org/10.54675/JKJB9835",
      },
      {
        text: "European Commission (2022). Ethical guidelines on the use of artificial intelligence (AI) and data in teaching and learning for educators. Publications Office of the European Union.",
        url: "https://education.ec.europa.eu/focus-topics/digital-education/action-plan/ethical-guidelines-for-educators-on-using-ai",
      },
      {
        text: "Ministero dell'Istruzione e del Merito (2025). Linee guida per l'introduzione dell'intelligenza artificiale nelle istituzioni scolastiche, versione 1.0 (D.M. n. 166 del 9 agosto 2025).",
        url: "https://www.mim.gov.it/-/decreto-ministeriale-n-166-del-9-agosto-2025",
      },
      {
        text: "OECD (2026). OECD Digital Education Outlook 2026: Exploring effective uses of generative AI in education. OECD Publishing.",
        url: "https://www.oecd.org/en/publications/oecd-digital-education-outlook-2026_062a7394-en.html",
      },
    ],
  },
  {
    id: "mit",
    items: [
      {
        text: "Klopfer, E., Reich, J., Abelson, H., & Breazeal, C. (2024). Generative AI and K-12 education: An MIT perspective. An MIT Exploration of Generative AI. MIT.",
        url: "https://education.mit.edu/announcements/newly-published-generative-ai-and-k-12-education-an-mit-perspective",
      },
      {
        text: "DiPaola, D., Salazar-Gómez, A. F., Abelson, H., Klopfer, E., Goldston, D., & Breazeal, C. (2024). How policy can help ensure the proper use of AI in K-12 education. MIT RAISE, policy brief.",
        url: "https://dspace.mit.edu/handle/1721.1/163140",
      },
      {
        text: "Smith, J. M., Dukes, J., Sheldon, J., Nnamani, M. N., Esteves, N., & Reich, J. (2025). A guide to AI in schools: Perspectives for the perplexed. MIT Teaching Systems Lab.",
        url: "https://tsl.mit.edu/ai-guidebook/",
      },
      {
        text: "Kosmyna, N., Hauptmann, E., Yuan, Y. T., Situ, J., Liao, X.-H., Beresnitzky, A. V., Braunstein, I., & Maes, P. (2025). Your brain on ChatGPT: Accumulation of cognitive debt when using an AI assistant for essay writing task. arXiv:2506.08872 (preprint, MIT Media Lab).",
        url: "https://arxiv.org/abs/2506.08872",
      },
      {
        text: "Reich, J. (2020). Failure to disrupt: Why technology alone can't transform education. Harvard University Press.",
      },
      {
        text: "Papert, S. (1980). Mindstorms: Children, computers, and powerful ideas. Basic Books.",
      },
    ],
  },
  {
    id: "interactive",
    items: [
      {
        text: "Chi, M. T. H., & Wylie, R. (2014). The ICAP framework: Linking cognitive engagement to active learning outcomes. Educational Psychologist, 49(4), 219-243.",
        url: "https://doi.org/10.1080/00461520.2014.965823",
      },
      {
        text: "Freeman, S., Eddy, S. L., McDonough, M., Smith, M. K., Okoroafor, N., Jordt, H., & Wenderoth, M. P. (2014). Active learning increases student performance in science, engineering, and mathematics. PNAS, 111(23), 8410-8415.",
        url: "https://doi.org/10.1073/pnas.1319030111",
      },
      {
        text: "Lave, J., & Wenger, E. (1991). Situated learning: Legitimate peripheral participation. Cambridge University Press.",
      },
      {
        text: "Stanovich, K. E., & West, R. F. (2000). Individual differences in reasoning: Implications for the rationality debate? Behavioral and Brain Sciences, 23(5), 645-665.",
        url: "https://doi.org/10.1017/S0140525X00003435",
      },
    ],
  },
  {
    id: "assessment",
    items: [
      {
        text: "Black, P., & Wiliam, D. (1998). Assessment and classroom learning. Assessment in Education: Principles, Policy & Practice, 5(1), 7-74.",
        url: "https://doi.org/10.1080/0969595980050102",
      },
      {
        text: "Hattie, J., & Timperley, H. (2007). The power of feedback. Review of Educational Research, 77(1), 81-112.",
        url: "https://doi.org/10.3102/003465430298487",
      },
      {
        text: "Zimmerman, B. J. (2002). Becoming a self-regulated learner: An overview. Theory Into Practice, 41(2), 64-70.",
        url: "https://doi.org/10.1207/s15430421tip4102_2",
      },
    ],
  },
  {
    id: "genai",
    items: [
      {
        text: "Bastani, H., Bastani, O., Sungu, A., Ge, H., Kabakcı, Ö., & Mariman, R. (2025). Generative AI without guardrails can harm learning: Evidence from high school mathematics. PNAS, 122(26), e2422633122.",
        url: "https://doi.org/10.1073/pnas.2422633122",
      },
      {
        text: "Kestin, G., Miller, K., Klales, A., Milbourne, T., & Ponti, G. (2025). AI tutoring outperforms in-class active learning: An RCT introducing a novel research-based design in an authentic educational setting. Scientific Reports, 15, 17458.",
        url: "https://doi.org/10.1038/s41598-025-97652-6",
      },
      {
        text: "Suriano, R., Plebe, A., Acciai, A., & Fabio, R. A. (2025). Student interaction with ChatGPT can promote complex critical thinking skills. Learning and Instruction, 95, 102011.",
        url: "https://doi.org/10.1016/j.learninstruc.2024.102011",
      },
      {
        text: "Giannakos, M., Azevedo, R., Brusilovsky, P., Cukurova, M., Dimitriadis, Y., Hernandez-Leo, D., Järvelä, S., Mavrikis, M., & Rienties, B. (2025). The promise and challenges of generative AI in education. Behaviour & Information Technology, 44(11), 2518-2544.",
        url: "https://doi.org/10.1080/0144929X.2024.2394886",
      },
      {
        text: "Messina, S., & Panciroli, C. (2025). Rethinking teaching with GenAI: Theoretical models and operational tools. Journal of Inclusive Methodology and Technology in Learning and Teaching, 5(1).",
      },
      {
        text: "Mollick, E. R., & Mollick, L. (2023). Assigning AI: Seven approaches for students, with prompts. SSRN.",
        url: "https://papers.ssrn.com/abstract=4475995",
      },
    ],
  },
];
